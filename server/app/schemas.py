"""
Pydantic schemas used for serializing and validating API requests and
responses.  These types mirror the domain objects defined in
models.py but avoid leaking implementation details such as hashed
passwords.  They also provide input validation for endpoints.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict

from .models import SizeEnum, ColorEnum, UnitEnum, MovementType, MovementStatus


# --------------------
# Authentication
# --------------------

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class UserOut(BaseModel):
    id: int
    name: str
    username: str
    email: Optional[str] = None
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --------------------
# Catalog
# --------------------

class ClassificationOut(BaseModel):
    id: int
    size: SizeEnum
    color: ColorEnum
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class ClassificationCreate(BaseModel):
    size: SizeEnum
    color: ColorEnum


class ClassificationUpdate(BaseModel):
    size: Optional[SizeEnum] = None
    color: Optional[ColorEnum] = None


class PriceOut(BaseModel):
    id: int
    classification_id: int
    unit: UnitEnum
    price_per_unit: float
    effective_from: datetime
    effective_to: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class PriceCreate(BaseModel):
    classification_id: int
    unit: UnitEnum
    price_per_unit: float
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None


class PriceUpdate(BaseModel):
    price_per_unit: Optional[float] = None
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None


# --------------------
# Inventory
# --------------------

class MovementOut(BaseModel):
    id: int
    type: MovementType
    classification_id: int
    qty_pcs: int
    unit_entered: UnitEnum
    qty_entered: int
    by_user_id: int
    status: MovementStatus
    linked_invoice_id: Optional[int]
    created_at: datetime
    committed_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class InventoryCard(BaseModel):
    classification_id: int
    size: SizeEnum
    color: ColorEnum
    qty_tray: float
    qty_dozen: float
    qty_pcs: int
    unit_price: Optional[float]


class InventorySummary(BaseModel):
    timestamp: datetime
    cards: List[InventoryCard]


class CreateInMovement(BaseModel):
    classification_id: int
    qty: int = Field(..., gt=0)
    unit: UnitEnum


class VerifyMovement(BaseModel):
    movement_id: int


class CommitMovement(BaseModel):
    movement_id: int


# --------------------
# Sales
# --------------------

class InvoiceItemCreate(BaseModel):
    classification_id: int
    qty: int = Field(..., gt=0)
    unit: UnitEnum


class InvoiceCreate(BaseModel):
    customer_name: Optional[str]
    customer_phone: Optional[str]
    items: List[InvoiceItemCreate]
    signature_png_b64: Optional[str]


class InvoiceItemOut(BaseModel):
    id: int
    classification_id: int
    unit: UnitEnum
    qty: int
    unit_price: float
    line_total: float

    model_config = ConfigDict(from_attributes=True)


class InvoiceOut(BaseModel):
    id: int
    customer_name: Optional[str]
    customer_phone: Optional[str]
    total_amount: float
    signature_png_path: Optional[str]
    created_by: int
    created_at: datetime
    items: List[InvoiceItemOut]

    model_config = ConfigDict(from_attributes=True)


# --------------------
# Reports
# --------------------


class DailySalesSummary(BaseModel):
    date: date
    invoice_count: int
    total_amount: float
    eggs_sold_pcs: int


class InventoryTurnoverMetric(BaseModel):
    classification_id: int
    size: SizeEnum
    color: ColorEnum
    total_in_pcs: int
    total_out_pcs: int
    opening_balance_pcs: int
    closing_balance_pcs: int
    average_inventory_pcs: float
    turnover_ratio: float


class CumulativeEggsSold(BaseModel):
    total_pcs: int
    total_dozens: float
    total_trays: float