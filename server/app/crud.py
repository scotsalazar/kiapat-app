"""
Database CRUD helpers.  These functions encapsulate the business logic
for interacting with the models.  They are used by the API endpoints
to perform operations on the database in a consistent manner.
"""

from __future__ import annotations

import base64
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from . import models, schemas, utils
from .notifier import inventory_notifier


# Ensure signature storage directory exists
SIGNATURE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "signatures")
os.makedirs(SIGNATURE_DIR, exist_ok=True)


def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.username == username).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[models.User]:
    return db.query(models.User).get(user_id)


def list_classifications(db: Session) -> List[models.Classification]:
    return db.query(models.Classification).filter(models.Classification.is_active == True).all()


def list_prices(db: Session) -> List[models.Price]:
    return db.query(models.Price).all()


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
