"""
Database CRUD helpers.  These functions encapsulate the business logic
for interacting with the models.  They are used by the API endpoints
to perform operations on the database in a consistent manner.
"""

from __future__ import annotations

import base64
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError

from . import auth, models, schemas, utils
from .notifier import inventory_notifier


# Ensure signature storage directory exists
SIGNATURE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "signatures")
os.makedirs(SIGNATURE_DIR, exist_ok=True)


def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.username == username).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[models.User]:
    return db.query(models.User).get(user_id)


def list_users(db: Session) -> List[models.User]:
    return db.query(models.User).order_by(models.User.id).all()


def create_user(db: Session, user_in: schemas.UserCreate) -> models.User:
    if get_user_by_username(db, user_in.username):
        raise ValueError("Username already exists")
    if user_in.email:
        existing_email = (
            db.query(models.User)
            .filter(models.User.email == user_in.email)
            .first()
        )
        if existing_email:
            raise ValueError("Email already exists")
    user = models.User(
        name=user_in.name,
        username=user_in.username,
        email=user_in.email,
        hashed_password=auth.get_password_hash(user_in.password),
        role=user_in.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, user_in: schemas.UserUpdate) -> models.User:
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")
    data = user_in.model_dump(exclude_unset=True)
    if not data:
        db.refresh(user)
        return user
    if "email" in data and data["email"]:
        existing_email = (
            db.query(models.User)
            .filter(models.User.email == data["email"], models.User.id != user.id)
            .first()
        )
        if existing_email:
            raise ValueError("Email already exists")
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> None:
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")
    db.delete(user)
    db.commit()


def reset_user_password(db: Session, user_id: int, new_password: str) -> models.User:
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")
    user.hashed_password = auth.get_password_hash(new_password)
    db.commit()
    db.refresh(user)
    return user


def list_classifications(db: Session) -> List[models.Classification]:
    return db.query(models.Classification).filter(models.Classification.is_active == True).all()


def _ensure_unique_classification(
    db: Session, size: models.SizeEnum, color: models.ColorEnum, exclude_id: Optional[int] = None
) -> None:
    query = db.query(models.Classification).filter(
        models.Classification.size == size, models.Classification.color == color
    )
    if exclude_id is not None:
        query = query.filter(models.Classification.id != exclude_id)
    if query.first():
        raise ValueError("Classification with the same size and color already exists")


def create_classification(
    db: Session, classification_in: schemas.ClassificationCreate
) -> models.Classification:
    _ensure_unique_classification(db, classification_in.size, classification_in.color)
    classification = models.Classification(
        size=classification_in.size, color=classification_in.color, is_active=True
    )
    db.add(classification)
    db.commit()
    db.refresh(classification)
    return classification


def update_classification(
    db: Session, classification_id: int, classification_in: schemas.ClassificationUpdate
) -> models.Classification:
    classification = db.query(models.Classification).get(classification_id)
    if not classification:
        raise ValueError("Classification not found")
    data = classification_in.model_dump(exclude_unset=True)
    if not data:
        db.refresh(classification)
        return classification
    size = data.get("size", classification.size)
    color = data.get("color", classification.color)
    if size != classification.size or color != classification.color:
        _ensure_unique_classification(db, size, color, exclude_id=classification.id)
    for field, value in data.items():
        setattr(classification, field, value)
    db.commit()
    db.refresh(classification)
    return classification


def set_classification_active(
    db: Session, classification_id: int, is_active: bool
) -> models.Classification:
    classification = db.query(models.Classification).get(classification_id)
    if not classification:
        raise ValueError("Classification not found")
    classification.is_active = is_active
    db.commit()
    db.refresh(classification)
    return classification


def delete_classification(db: Session, classification_id: int) -> None:
    classification = db.query(models.Classification).get(classification_id)
    if not classification:
        raise ValueError("Classification not found")
    db.delete(classification)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("Unable to delete classification with related records")


def list_prices(db: Session) -> List[models.Price]:
    return db.query(models.Price).all()


def _validate_price_range(
    db: Session,
    classification_id: int,
    unit: models.UnitEnum,
    effective_from: datetime,
    effective_to: Optional[datetime],
    exclude_price_id: Optional[int] = None,
) -> None:
    if effective_to is not None and effective_to <= effective_from:
        raise ValueError("effective_to must be later than effective_from")
    query = db.query(models.Price).filter(
        models.Price.classification_id == classification_id,
        models.Price.unit == unit,
    )
    if exclude_price_id is not None:
        query = query.filter(models.Price.id != exclude_price_id)
    for existing in query.all():
        existing_from = existing.effective_from
        existing_to = existing.effective_to
        # No overlap if existing ends before new starts or new ends before existing starts
        if existing_to is not None and existing_to <= effective_from:
            continue
        if effective_to is not None and effective_to <= existing_from:
            continue
        raise ValueError("Price period overlaps with an existing price")


def create_price(db: Session, price_in: schemas.PriceCreate) -> models.Price:
    effective_from = price_in.effective_from or datetime.utcnow()
    effective_to = price_in.effective_to
    _validate_price_range(
        db,
        price_in.classification_id,
        price_in.unit,
        effective_from,
        effective_to,
    )
    price = models.Price(
        classification_id=price_in.classification_id,
        unit=price_in.unit,
        price_per_unit=price_in.price_per_unit,
        effective_from=effective_from,
        effective_to=effective_to,
    )
    db.add(price)
    db.commit()
    db.refresh(price)
    return price


def update_price(db: Session, price_id: int, price_in: schemas.PriceUpdate) -> models.Price:
    price = db.query(models.Price).get(price_id)
    if not price:
        raise ValueError("Price not found")
    data = price_in.model_dump(exclude_unset=True)
    if not data:
        db.refresh(price)
        return price
    if "price_per_unit" in data:
        price.price_per_unit = data["price_per_unit"]
    if "effective_from" in data and data["effective_from"] is not None:
        price.effective_from = data["effective_from"]
    if "effective_to" in data:
        price.effective_to = data["effective_to"]
    _validate_price_range(
        db,
        price.classification_id,
        price.unit,
        price.effective_from,
        price.effective_to,
        exclude_price_id=price.id,
    )
    db.commit()
    db.refresh(price)
    return price


def activate_price(db: Session, price_id: int) -> models.Price:
    price = db.query(models.Price).get(price_id)
    if not price:
        raise ValueError("Price not found")
    price.effective_to = None
    _validate_price_range(
        db,
        price.classification_id,
        price.unit,
        price.effective_from,
        price.effective_to,
        exclude_price_id=price.id,
    )
    db.commit()
    db.refresh(price)
    return price


def deactivate_price(db: Session, price_id: int) -> models.Price:
    price = db.query(models.Price).get(price_id)
    if not price:
        raise ValueError("Price not found")
    now = datetime.utcnow()
    price.effective_to = now if now > price.effective_from else price.effective_from
    db.commit()
    db.refresh(price)
    return price


def delete_price(db: Session, price_id: int) -> None:
    price = db.query(models.Price).get(price_id)
    if not price:
        raise ValueError("Price not found")
    db.delete(price)
    db.commit()


def get_inventory_summary(db: Session) -> schemas.InventorySummary:
    """
    Compute the current inventory summary.  This sums the current
    inventory balances and returns quantities in trays, dozens and
    pieces along with the current price per dozen for each
    classification.
    """
    timestamp = datetime.utcnow()
    cards: List[schemas.InventoryCard] = []
    classifications = list_classifications(db)
    for c in classifications:
        balance = c.inventory_balance
        qty_pcs = balance.qty_pcs if balance else 0
        qty_tray = utils.from_pcs(qty_pcs, models.UnitEnum.TRAY)
        qty_dozen = utils.from_pcs(qty_pcs, models.UnitEnum.DOZEN)
        # default price per dozen
        price = utils.get_current_price(db, c.id, models.UnitEnum.DOZEN)
        unit_price = price.price_per_unit if price else None
        cards.append(
            schemas.InventoryCard(
                classification_id=c.id,
                size=c.size,
                color=c.color,
                qty_tray=qty_tray,
                qty_dozen=qty_dozen,
                qty_pcs=qty_pcs,
                unit_price=unit_price,
            )
        )
    return schemas.InventorySummary(timestamp=timestamp, cards=cards)


def list_movements(
    db: Session, movement_type: Optional[models.MovementType] = None, limit: int = 50
) -> List[models.InventoryMovement]:
    query = db.query(models.InventoryMovement)
    if movement_type:
        query = query.filter(models.InventoryMovement.type == movement_type)
    return (
        query.order_by(models.InventoryMovement.created_at.desc())
        .limit(limit)
        .all()
    )


def _build_inventory_event(db: Session) -> Dict[str, Any]:
    summary = get_inventory_summary(db)
    movements = list_movements(db, limit=20)
    prices = list_prices(db)
    return {
        "type": "inventory_update",
        "summary": summary.model_dump(mode="json"),
        "movements": [
            schemas.MovementOut.model_validate(m).model_dump(mode="json") for m in movements
        ],
        "prices": [
            schemas.PriceOut.model_validate(p).model_dump(mode="json") for p in prices
        ],
    }


def create_in_movement(db: Session, user: models.User, movement: schemas.CreateInMovement) -> models.InventoryMovement:
    """Create a new IN movement in DRAFT status."""
    qty_pcs = utils.to_pcs(movement.qty, movement.unit)
    m = models.InventoryMovement(
        type=models.MovementType.IN,
        classification_id=movement.classification_id,
        qty_pcs=qty_pcs,
        unit_entered=movement.unit,
        qty_entered=movement.qty,
        by_user_id=user.id,
        status=models.MovementStatus.DRAFT,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def verify_movement(db: Session, user: models.User, movement_id: int) -> models.InventoryMovement:
    """Verify an inventory movement, setting its status to VERIFIED.  Only
    applicable to IN movements in DRAFT status.
    """
    m = db.query(models.InventoryMovement).get(movement_id)
    if not m or m.type != models.MovementType.IN or m.status != models.MovementStatus.DRAFT:
        raise ValueError("Invalid movement for verification")
    m.status = models.MovementStatus.VERIFIED
    m.committed_at = datetime.utcnow()
    m.by_user_id = user.id
    db.commit()
    db.refresh(m)
    return m


def commit_movement(db: Session, user: models.User, movement_id: int) -> models.InventoryMovement:
    """Commit a verified inventory movement, updating inventory balance
    accordingly and marking the movement as COMMITTED.
    """
    m = db.query(models.InventoryMovement).get(movement_id)
    if not m or m.type != models.MovementType.IN or m.status != models.MovementStatus.VERIFIED:
        raise ValueError("Invalid movement for commit")
    # Update inventory balance
    balance = (
        db.query(models.InventoryBalance)
        .filter(models.InventoryBalance.classification_id == m.classification_id)
        .first()
    )
    if not balance:
        balance = models.InventoryBalance(
            classification_id=m.classification_id, qty_pcs=0
        )
        db.add(balance)
    balance.qty_pcs += m.qty_pcs
    balance.updated_at = datetime.utcnow()
    m.status = models.MovementStatus.COMMITTED
    m.committed_at = datetime.utcnow()
    db.commit()
    db.refresh(m)
    inventory_notifier.publish(_build_inventory_event(db))
    return m


def create_invoice(db: Session, user: models.User, invoice_in: schemas.InvoiceCreate) -> models.Invoice:
    """
    Create a sales invoice with line items.  This operation will
    calculate totals using current pricing, decrement inventory and
    record an OUT movement for each line.  It will raise an exception
    if stock would go negative.
    """
    total_amount = 0.0
    items: List[models.InvoiceItem] = []
    movements: List[models.InventoryMovement] = []
    # Check and calculate
    for item in invoice_in.items:
        price = utils.get_current_price(db, item.classification_id, item.unit)
        if not price:
            raise ValueError(f"No price defined for classification {item.classification_id} unit {item.unit}")
        unit_price = price.price_per_unit
        line_total = unit_price * item.qty
        total_amount += line_total
        # convert to pcs for stock check
        qty_pcs = utils.to_pcs(item.qty, item.unit)
        # check stock
        bal = (
            db.query(models.InventoryBalance)
            .filter(models.InventoryBalance.classification_id == item.classification_id)
            .first()
        )
        current_pcs = bal.qty_pcs if bal else 0
        if current_pcs < qty_pcs:
            raise ValueError("Not enough stock for classification")
        # prepare invoice item and movement
        items.append(
            models.InvoiceItem(
                classification_id=item.classification_id,
                unit=item.unit,
                qty=item.qty,
                unit_price=unit_price,
                line_total=line_total,
            )
        )
        movements.append(
            models.InventoryMovement(
                type=models.MovementType.OUT,
                classification_id=item.classification_id,
                qty_pcs=qty_pcs,
                unit_entered=item.unit,
                qty_entered=item.qty,
                by_user_id=user.id,
                status=models.MovementStatus.COMMITTED,
            )
        )
    # Save signature file if provided
    signature_path = None
    if invoice_in.signature_png_b64:
        # decode base64 and write to file with unique name
        data = base64.b64decode(invoice_in.signature_png_b64.split(",")[-1])
        filename = f"sig_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}.png"
        filepath = os.path.join(SIGNATURE_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(data)
        signature_path = filepath
    # Create invoice
    invoice = models.Invoice(
        customer_name=invoice_in.customer_name,
        customer_phone=invoice_in.customer_phone,
        total_amount=total_amount,
        signature_png_path=signature_path,
        created_by=user.id,
        created_at=datetime.utcnow(),
    )
    invoice.items = items
    db.add(invoice)
    db.flush()  # assign invoice id
    # update movements with invoice_id and update stock
    for mv in movements:
        mv.linked_invoice_id = invoice.id
        db.add(mv)
        # decrement stock
        bal = (
            db.query(models.InventoryBalance)
            .filter(models.InventoryBalance.classification_id == mv.classification_id)
            .first()
        )
        if not bal:
            bal = models.InventoryBalance(
                classification_id=mv.classification_id, qty_pcs=0
            )
            db.add(bal)
        bal.qty_pcs -= mv.qty_pcs
        bal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(invoice)
    inventory_notifier.publish(_build_inventory_event(db))
    return invoice


def list_invoices(
    db: Session,
    user: models.User,
    *,
    page: int,
    page_size: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    customer: Optional[str] = None,
    driver: Optional[str] = None,
    status: Optional[models.MovementStatus] = None,
) -> Tuple[List[models.Invoice], int]:
    """Return paginated invoices filtered by the provided criteria."""

    query = (
        db.query(models.Invoice)
        .options(
            selectinload(models.Invoice.items),
            selectinload(models.Invoice.created_by_user),
        )
        .order_by(models.Invoice.created_at.desc())
    )

    if user.role == models.RoleEnum.DRIVER:
        query = query.filter(models.Invoice.created_by == user.id)
    elif driver:
        like = f"%{driver}%"
        query = query.filter(
            or_(
                models.Invoice.created_by_user.has(models.User.name.ilike(like)),
                models.Invoice.created_by_user.has(models.User.username.ilike(like)),
            )
        )

    if start_date:
        query = query.filter(models.Invoice.created_at >= start_date)
    if end_date:
        query = query.filter(models.Invoice.created_at <= end_date)
    if customer:
        like = f"%{customer}%"
        query = query.filter(
            or_(
                models.Invoice.customer_name.ilike(like),
                models.Invoice.customer_phone.ilike(like),
            )
        )
    if status:
        query = query.filter(
            models.Invoice.movements.any(models.InventoryMovement.status == status)
        )

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total
