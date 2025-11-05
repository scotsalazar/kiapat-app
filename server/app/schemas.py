"""
Pydantic schemas used for serializing and validating API requests and
responses.  These types mirror the domain objects defined in
models.py but avoid leaking implementation details such as hashed
passwords.  They also provide input validation for endpoints.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict

from .models import (
    SizeEnum,
    ColorEnum,
    UnitEnum,
    MovementType,
    MovementStatus,
    InvoiceStatus,
    OverrideStatus,
)


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
    override_shortage_pcs: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class InvoiceOverrideItemOut(BaseModel):
    invoice_item_id: int
    requested_qty_pcs: int
    available_qty_pcs: int
    shortage_qty_pcs: int

    model_config = ConfigDict(from_attributes=True)


class InvoiceOverrideBriefOut(BaseModel):
    id: int
    status: OverrideStatus
    note: Optional[str]
    created_at: datetime
    decided_at: Optional[datetime]
    items: List[InvoiceOverrideItemOut]

    model_config = ConfigDict(from_attributes=True)


class InvoiceBaseOut(BaseModel):
    id: int
    customer_name: Optional[str]
    customer_phone: Optional[str]
    total_amount: float
    signature_png_path: Optional[str]
    created_by: int
    created_at: datetime
    status: InvoiceStatus
    items: List[InvoiceItemOut]

    model_config = ConfigDict(from_attributes=True)


class InvoiceOut(InvoiceBaseOut):
    override_request: Optional[InvoiceOverrideBriefOut]


class InvoiceOverrideOut(BaseModel):
    id: int
    invoice_id: int
    status: OverrideStatus
    note: Optional[str]
    requested_by_id: int
    reviewed_by_id: Optional[int]
    created_at: datetime
    decided_at: Optional[datetime]
    items: List[InvoiceOverrideItemOut]
    invoice: InvoiceBaseOut

    model_config = ConfigDict(from_attributes=True)


class OverrideDecision(BaseModel):
    note: Optional[str] = None