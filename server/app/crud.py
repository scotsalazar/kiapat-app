"""
Database CRUD helpers.  These functions encapsulate the business logic
for interacting with the models.  They are used by the API endpoints
to perform operations on the database in a consistent manner.
"""

from __future__ import annotations

import base64
import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import status
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError

from . import auth, models, schemas, utils
from .errors import AppError, ErrorCode
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
        raise AppError(
            ErrorCode.USERS_USERNAME_EXISTS,
            "Username already exists",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    if user_in.email:
        existing_email = (
            db.query(models.User)
            .filter(models.User.email == user_in.email)
            .first()
        )
        if existing_email:
            raise AppError(
                ErrorCode.USERS_EMAIL_EXISTS,
                "Email already exists",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
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
        raise AppError(ErrorCode.USERS_NOT_FOUND, "User not found", status_code=status.HTTP_404_NOT_FOUND)
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
            raise AppError(
                ErrorCode.USERS_EMAIL_EXISTS,
                "Email already exists",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> None:
    user = get_user_by_id(db, user_id)
    if not user:
        raise AppError(ErrorCode.USERS_NOT_FOUND, "User not found", status_code=status.HTTP_404_NOT_FOUND)
    db.delete(user)
    db.commit()


def reset_user_password(db: Session, user_id: int, new_password: str) -> models.User:
    user = get_user_by_id(db, user_id)
    if not user:
        raise AppError(ErrorCode.USERS_NOT_FOUND, "User not found", status_code=status.HTTP_404_NOT_FOUND)
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
        raise AppError(
            ErrorCode.CATALOG_DUPLICATE,
            "Classification with the same size and color already exists",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


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
        raise AppError(
            ErrorCode.CATALOG_NOT_FOUND,
            "Classification not found",
            status_code=status.HTTP_404_NOT_FOUND,
        )
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
        raise AppError(
            ErrorCode.CATALOG_NOT_FOUND,
            "Classification not found",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    classification.is_active = is_active
    db.commit()
    db.refresh(classification)
    return classification


def delete_classification(db: Session, classification_id: int) -> None:
    classification = db.query(models.Classification).get(classification_id)
    if not classification:
        raise AppError(
            ErrorCode.CATALOG_NOT_FOUND,
            "Classification not found",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    db.delete(classification)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(
            ErrorCode.CATALOG_DELETE_CONFLICT,
            "Unable to delete classification with related records",
            status_code=status.HTTP_409_CONFLICT,
        )


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
        raise AppError(
            ErrorCode.PRICING_INVALID_RANGE,
            "effective_to must be later than effective_from",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
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
        raise AppError(
            ErrorCode.PRICING_OVERLAP,
            "Price period overlaps with an existing price",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


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
        raise AppError(ErrorCode.PRICING_NOT_FOUND, "Price not found", status_code=status.HTTP_404_NOT_FOUND)
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
        raise AppError(ErrorCode.PRICING_NOT_FOUND, "Price not found", status_code=status.HTTP_404_NOT_FOUND)
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
        raise AppError(ErrorCode.PRICING_NOT_FOUND, "Price not found", status_code=status.HTTP_404_NOT_FOUND)
    now = datetime.utcnow()
    price.effective_to = now if now > price.effective_from else price.effective_from
    db.commit()
    db.refresh(price)
    return price


def delete_price(db: Session, price_id: int) -> None:
    price = db.query(models.Price).get(price_id)
    if not price:
        raise AppError(ErrorCode.PRICING_NOT_FOUND, "Price not found", status_code=status.HTTP_404_NOT_FOUND)
    db.delete(price)
    db.commit()


def get_inventory_summary(
    db: Session,
    *,
    size: Optional[models.SizeEnum] = None,
    color: Optional[models.ColorEnum] = None,
    search: Optional[str] = None,
    low_stock_only: bool = False,
) -> schemas.InventorySummary:
    """
    Compute the current inventory summary.  This sums the current
    inventory balances and returns quantities in trays, dozens and
    pieces along with the current price per dozen for each
    classification.
    """
    timestamp = datetime.utcnow()
    cards: List[schemas.InventoryCard] = []
    query = db.query(models.Classification).filter(models.Classification.is_active == True)
    if size:
        query = query.filter(models.Classification.size == size)
    if color:
        query = query.filter(models.Classification.color == color)
    classifications = query.all()
    thresholds = {
        threshold.classification_id: threshold.threshold_pcs
        for threshold in db.query(models.InventoryThreshold).all()
    }
    total_qty_pcs = 0
    total_stock_value = 0.0
    has_stock_value = False
    search_tokens: List[str] = []
    if search:
        search_tokens = [token for token in search.lower().split() if token]
    for c in classifications:
        balance = c.inventory_balance
        qty_pcs = balance.qty_pcs if balance else 0
        qty_tray = utils.from_pcs(qty_pcs, models.UnitEnum.TRAY)
        qty_dozen = utils.from_pcs(qty_pcs, models.UnitEnum.DOZEN)
        # default price per dozen
        price = utils.get_current_price(db, c.id, models.UnitEnum.DOZEN)
        unit_price = price.price_per_unit if price else None
        stock_value = None
        if unit_price is not None:
            stock_value = qty_dozen * unit_price
        threshold_pcs = thresholds.get(c.id)
        is_low = threshold_pcs is not None and qty_pcs <= threshold_pcs
        size_value = getattr(c.size, "value", c.size)
        color_value = getattr(c.color, "value", c.color)
        label = f"{size_value} {color_value}".strip().lower()
        if search_tokens and not all(token in label for token in search_tokens):
            continue
        if low_stock_only and not is_low:
            continue
        card = schemas.InventoryCard(
            classification_id=c.id,
            size=c.size,
            color=c.color,
            qty_tray=qty_tray,
            qty_dozen=qty_dozen,
            qty_pcs=qty_pcs,
            unit_price=unit_price,
            stock_value=stock_value,
            threshold_pcs=threshold_pcs,
            is_low=is_low,
        )
        cards.append(card)
        total_qty_pcs += qty_pcs
        if stock_value is not None:
            total_stock_value += stock_value
            has_stock_value = True
    totals = schemas.InventoryTotals(
        qty_tray=utils.from_pcs(total_qty_pcs, models.UnitEnum.TRAY),
        qty_dozen=utils.from_pcs(total_qty_pcs, models.UnitEnum.DOZEN),
        qty_pcs=total_qty_pcs,
        stock_value=total_stock_value if has_stock_value else None,
    )
    return schemas.InventorySummary(timestamp=timestamp, totals=totals, cards=cards)


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


def list_inventory_thresholds(db: Session) -> List[models.InventoryThreshold]:
    return db.query(models.InventoryThreshold).order_by(models.InventoryThreshold.classification_id).all()


def set_inventory_thresholds(
    db: Session, updates: List[schemas.InventoryThresholdUpdate]
) -> List[models.InventoryThreshold]:
    if not updates:
        return list_inventory_thresholds(db)

    classification_ids = {update.classification_id for update in updates}
    existing_thresholds = {
        threshold.classification_id: threshold
        for threshold in db.query(models.InventoryThreshold)
        .filter(models.InventoryThreshold.classification_id.in_(classification_ids))
        .all()
    }
    classifications = {
        classification.id: classification
        for classification in db.query(models.Classification)
        .filter(models.Classification.id.in_(classification_ids))
        .all()
    }
    missing = classification_ids - classifications.keys()
    if missing:
        raise AppError(
            ErrorCode.CATALOG_NOT_FOUND,
            "Some classifications were not found",
            details={"missing_ids": sorted(missing)},
            status_code=status.HTTP_404_NOT_FOUND,
        )

    for update in updates:
        threshold = existing_thresholds.get(update.classification_id)
        if update.threshold_pcs <= 0:
            if threshold:
                db.delete(threshold)
        else:
            if threshold:
                threshold.threshold_pcs = update.threshold_pcs
            else:
                db.add(
                    models.InventoryThreshold(
                        classification_id=update.classification_id,
                        threshold_pcs=update.threshold_pcs,
                    )
                )

    db.commit()
    return list_inventory_thresholds(db)


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
        details = {"movement_id": movement_id}
        if m:
            details.update(
                {
                    "current_status": m.status.value,
                    "movement_type": m.type.value,
                }
            )
        raise AppError(
            ErrorCode.INVENTORY_INVALID_STATE,
            "Invalid movement for verification",
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details,
        )
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
        details = {"movement_id": movement_id}
        if m:
            details.update(
                {
                    "current_status": m.status.value,
                    "movement_type": m.type.value,
                }
            )
        raise AppError(
            ErrorCode.INVENTORY_INVALID_STATE,
            "Invalid movement for commit",
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details,
        )
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
    calculate totals using current pricing.  If all quantities are
    available it will immediately decrement inventory and record
    committed OUT movements.  When requested quantities exceed the
    available stock, the invoice is recorded with a pending override
    request so an administrator can review it later.
    """
    if not invoice_in.items:
        raise AppError(
            ErrorCode.SALES_EMPTY_INVOICE,
            "Invoice must contain at least one item",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    line_details: List[Dict[str, Any]] = []
    total_amount = 0.0

    for item in invoice_in.items:
        price = utils.get_current_price(db, item.classification_id, item.unit)
        if not price:
            raise AppError(
                ErrorCode.SALES_PRICE_MISSING,
                "No price defined for the requested classification and unit",
                status_code=status.HTTP_400_BAD_REQUEST,
                details={
                    "classification_id": item.classification_id,
                    "unit": item.unit.value if hasattr(item.unit, "value") else str(item.unit),
                },
            )
        unit_price = price.price_per_unit
        line_total = unit_price * item.qty
        qty_pcs = utils.to_pcs(item.qty, item.unit)
        bal = (
            db.query(models.InventoryBalance)
            .filter(models.InventoryBalance.classification_id == item.classification_id)
            .first()
        )
        current_pcs = bal.qty_pcs if bal else 0
        has_stock = current_pcs >= qty_pcs
        total_amount += line_total
        line_details.append(
            {
                "classification_id": item.classification_id,
                "unit": item.unit,
                "qty": item.qty,
                "qty_pcs": qty_pcs,
                "unit_price": unit_price,
                "line_total": line_total,
                "current_pcs": current_pcs,
                "has_stock": has_stock,
            }
        )

    requires_override = any(not detail["has_stock"] for detail in line_details)
    invoice_status = (
        models.InvoiceStatus.PENDING_OVERRIDE
        if requires_override
        else models.InvoiceStatus.COMPLETED
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
        status=invoice_status,
    )
    invoice.items = [
        models.InvoiceItem(
            classification_id=detail["classification_id"],
            unit=detail["unit"],
            qty=detail["qty"],
            unit_price=detail["unit_price"],
            line_total=detail["line_total"],
        )
        for detail in line_details
    ]
    if requires_override:
        invoice.overrides = [
            models.InvoiceOverride(
                classification_id=detail["classification_id"],
                requested_qty_pcs=detail["qty_pcs"],
                requested_unit=detail["unit"],
                available_qty_pcs=detail["current_pcs"],
                requested_by_id=user.id,
            )
            for detail in line_details
            if not detail["has_stock"]
        ]
    db.add(invoice)
    db.flush()  # assign invoice id
    # create movements and optionally adjust inventory
    publish_inventory = False
    for detail in line_details:
        mv_status = (
            models.MovementStatus.COMMITTED
            if invoice_status == models.InvoiceStatus.COMPLETED
            else models.MovementStatus.PENDING_OVERRIDE
        )
        mv = models.InventoryMovement(
            type=models.MovementType.OUT,
            classification_id=detail["classification_id"],
            qty_pcs=detail["qty_pcs"],
            unit_entered=detail["unit"],
            qty_entered=detail["qty"],
            by_user_id=user.id,
            status=mv_status,
            linked_invoice_id=invoice.id,
        )
        db.add(mv)
        if invoice_status == models.InvoiceStatus.COMPLETED:
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
            publish_inventory = True
    db.commit()
    db.refresh(invoice)
    if publish_inventory:
        inventory_notifier.publish(_build_inventory_event(db))
    return invoice


def list_pending_overrides(db: Session) -> List[models.InvoiceOverride]:
    """Return all pending invoice override requests."""
    return (
        db.query(models.InvoiceOverride)
        .options(
            selectinload(models.InvoiceOverride.invoice).selectinload(
                models.Invoice.items
            ),
            selectinload(models.InvoiceOverride.invoice).selectinload(
                models.Invoice.created_by_user
            ),
            selectinload(models.InvoiceOverride.classification),
        )
        .filter(models.InvoiceOverride.status == models.OverrideStatus.PENDING)
        .order_by(models.InvoiceOverride.created_at.asc())
        .all()
    )


def approve_invoice_override(
    db: Session, admin: models.User, invoice_id: int, reason: Optional[str] = None
) -> models.Invoice:
    """Approve a pending override and commit inventory movements."""

    invoice = (
        db.query(models.Invoice)
        .options(
            selectinload(models.Invoice.overrides),
            selectinload(models.Invoice.movements),
        )
        .get(invoice_id)
    )
    if not invoice:
        raise AppError(ErrorCode.SALES_NOT_FOUND, "Invoice not found", status_code=status.HTTP_404_NOT_FOUND)
    if invoice.status != models.InvoiceStatus.PENDING_OVERRIDE:
        raise AppError(
            ErrorCode.SALES_INVALID_STATE,
            "Invoice does not have a pending override",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"invoice_id": invoice_id, "status": invoice.status.value},
        )

    now = datetime.utcnow()
    publish_inventory = False
    for override in invoice.overrides:
        override.status = models.OverrideStatus.APPROVED
        override.decided_by_id = admin.id
        override.decided_at = now
        if reason:
            override.decision_reason = reason

    for mv in invoice.movements:
        if mv.status == models.MovementStatus.PENDING_OVERRIDE:
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
            bal.updated_at = now
            mv.status = models.MovementStatus.COMMITTED
            mv.committed_at = now
            publish_inventory = True

    invoice.status = models.InvoiceStatus.COMPLETED
    db.commit()
    db.refresh(invoice)
    if publish_inventory:
        inventory_notifier.publish(_build_inventory_event(db))
    return invoice


def reject_invoice_override(
    db: Session, admin: models.User, invoice_id: int, reason: Optional[str] = None
) -> models.Invoice:
    """Reject a pending override request."""

    invoice = (
        db.query(models.Invoice)
        .options(selectinload(models.Invoice.overrides), selectinload(models.Invoice.movements))
        .get(invoice_id)
    )
    if not invoice:
        raise AppError(ErrorCode.SALES_NOT_FOUND, "Invoice not found", status_code=status.HTTP_404_NOT_FOUND)
    if invoice.status != models.InvoiceStatus.PENDING_OVERRIDE:
        raise AppError(
            ErrorCode.SALES_INVALID_STATE,
            "Invoice does not have a pending override",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"invoice_id": invoice_id, "status": invoice.status.value},
        )

    now = datetime.utcnow()
    for override in invoice.overrides:
        override.status = models.OverrideStatus.REJECTED
        override.decided_by_id = admin.id
        override.decided_at = now
        override.decision_reason = reason

    for mv in invoice.movements:
        if mv.status == models.MovementStatus.PENDING_OVERRIDE:
            mv.status = models.MovementStatus.REJECTED
            mv.committed_at = now

    invoice.status = models.InvoiceStatus.REJECTED
    db.commit()
    db.refresh(invoice)
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
    invoice_status: Optional[models.InvoiceStatus] = None,
) -> Tuple[List[models.Invoice], int]:
    """Return paginated invoices filtered by the provided criteria."""

    query = (
        db.query(models.Invoice)
        .options(
            selectinload(models.Invoice.items),
            selectinload(models.Invoice.created_by_user),
            selectinload(models.Invoice.overrides),
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
    if invoice_status:
        query = query.filter(models.Invoice.status == invoice_status)

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def get_daily_sales_summary(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[schemas.DailySalesSummary]:
    """Aggregate invoices into daily sales metrics."""
    qty_case = case(
        (models.InvoiceItem.unit == models.UnitEnum.TRAY, models.InvoiceItem.qty * utils.TRAY_SIZE),
        (models.InvoiceItem.unit == models.UnitEnum.DOZEN, models.InvoiceItem.qty * utils.DOZEN_SIZE),
        else_=models.InvoiceItem.qty,
    )
    date_expr = func.date(models.Invoice.created_at)
    query = (
        db.query(
            date_expr.label("sale_date"),
            func.sum(models.Invoice.total_amount).label("total_amount"),
            func.sum(qty_case).label("eggs_sold_pcs"),
            func.count(func.distinct(models.Invoice.id)).label("invoice_count"),
        )
        .join(models.InvoiceItem, models.InvoiceItem.invoice_id == models.Invoice.id)
    )
    if start_date:
        query = query.filter(models.Invoice.created_at >= start_date)
    if end_date:
        query = query.filter(models.Invoice.created_at <= end_date)
    query = query.group_by(date_expr).order_by(date_expr)
    summaries: List[schemas.DailySalesSummary] = []
    for row in query.all():
        sale_date = row.sale_date
        if isinstance(sale_date, datetime):
            sale_date_value = sale_date.date()
        elif isinstance(sale_date, str):
            sale_date_value = datetime.strptime(sale_date, "%Y-%m-%d").date()
        elif isinstance(sale_date, date):
            sale_date_value = sale_date
        else:
            sale_date_value = datetime.utcfromtimestamp(0).date()
        summaries.append(
            schemas.DailySalesSummary(
                date=sale_date_value,
                total_amount=float(row.total_amount or 0.0),
                eggs_sold_pcs=int(row.eggs_sold_pcs or 0),
                invoice_count=int(row.invoice_count or 0),
            )
        )
    return summaries


def get_inventory_turnover(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[schemas.InventoryTurnoverMetric]:
    """Compute inventory turnover metrics per classification."""
    total_in_expr = func.sum(
        case(
            (models.InventoryMovement.type == models.MovementType.IN, models.InventoryMovement.qty_pcs),
            else_=0,
        )
    ).label("total_in_pcs")
    total_out_expr = func.sum(
        case(
            (models.InventoryMovement.type == models.MovementType.OUT, models.InventoryMovement.qty_pcs),
            else_=0,
        )
    ).label("total_out_pcs")
    query = (
        db.query(
            models.InventoryMovement.classification_id.label("classification_id"),
            models.Classification.size.label("size"),
            models.Classification.color.label("color"),
            total_in_expr,
            total_out_expr,
        )
        .join(
            models.Classification,
            models.Classification.id == models.InventoryMovement.classification_id,
        )
        .filter(models.InventoryMovement.status == models.MovementStatus.COMMITTED)
    )
    if start_date:
        query = query.filter(models.InventoryMovement.created_at >= start_date)
    if end_date:
        query = query.filter(models.InventoryMovement.created_at <= end_date)
    query = query.group_by(
        models.InventoryMovement.classification_id,
        models.Classification.size,
        models.Classification.color,
    ).order_by(models.InventoryMovement.classification_id)
    metrics: List[schemas.InventoryTurnoverMetric] = []
    for row in query.all():
        total_in = int(row.total_in_pcs or 0)
        total_out = int(row.total_out_pcs or 0)
        turnover_ratio = (total_out / total_in) if total_in else None
        metrics.append(
            schemas.InventoryTurnoverMetric(
                classification_id=row.classification_id,
                size=row.size,
                color=row.color,
                total_in_pcs=total_in,
                total_out_pcs=total_out,
                turnover_ratio=turnover_ratio,
            )
        )
    return metrics


def get_cumulative_eggs_sold(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> schemas.CumulativeEggsSold:
    """Return the total eggs sold in the period in multiple units."""
    query = db.query(func.sum(models.InventoryMovement.qty_pcs)).filter(
        models.InventoryMovement.type == models.MovementType.OUT,
        models.InventoryMovement.status == models.MovementStatus.COMMITTED,
    )
    if start_date:
        query = query.filter(models.InventoryMovement.created_at >= start_date)
    if end_date:
        query = query.filter(models.InventoryMovement.created_at <= end_date)
    total_pcs = query.scalar() or 0
    total_pcs_int = int(total_pcs)
    total_tray = total_pcs_int / utils.TRAY_SIZE if total_pcs_int else 0.0
    total_dozen = total_pcs_int / utils.DOZEN_SIZE if total_pcs_int else 0.0
    return schemas.CumulativeEggsSold(
        total_eggs_pcs=total_pcs_int,
        total_eggs_tray=total_tray,
        total_eggs_dozen=total_dozen,
    )
