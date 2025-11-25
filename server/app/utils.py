"""
Utility functions for unit conversion and pricing lookup.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from . import models


TRAY_SIZE = 30
DOZEN_SIZE = 12
PCS_SIZE = 1


def to_pcs(qty: int, unit: models.UnitEnum) -> int:
    """Convert a quantity in the specified unit to individual pieces."""
    if unit == models.UnitEnum.TRAY:
        return qty * TRAY_SIZE
    if unit == models.UnitEnum.DOZEN:
        return qty * DOZEN_SIZE
    return qty


def from_pcs(pcs: int, unit: models.UnitEnum) -> float:
    """Convert a quantity in pieces to the given unit (may be fractional)."""
    if unit == models.UnitEnum.TRAY:
        return pcs / TRAY_SIZE
    if unit == models.UnitEnum.DOZEN:
        return pcs / DOZEN_SIZE
    return float(pcs)


def get_current_price(
    db: Session, classification_id: int, unit: models.UnitEnum
) -> Optional[models.Price]:
    """
    Retrieve the most recent active price for a given classification and unit.
    Prices are considered active if their effective_from is <= now and
    effective_to is either None or in the future.
    """
    now = datetime.utcnow()
    return (
        db.query(models.Price)
        .filter(
            models.Price.classification_id == classification_id,
            models.Price.unit == unit,
            models.Price.effective_from <= now,
            (models.Price.effective_to.is_(None) | (models.Price.effective_to > now)),
        )
        .order_by(models.Price.effective_from.desc())
        .first()
    )