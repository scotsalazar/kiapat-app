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
    RoleEnum,
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
    role: RoleEnum
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    name: str
    username: str
    email: Optional[str] = None
    password: str = Field(..., min_length=8)
    role: RoleEnum


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[RoleEnum] = None


class PasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=8)


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


class OverrideRequestOut(BaseModel):
    id: int
    movement_id: int
    invoice_id: int
    requested_by_id: int
    status: OverrideStatus
    shortage_qty_pcs: int
    available_qty_pcs: int
    admin_comment: Optional[str]
    requested_at: datetime
    resolved_at: Optional[datetime]
    resolved_by_id: Optional[int]
    movement: Optional[MovementOut] = None

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
    pending_overrides: Optional[List[OverrideRequestOut]] = None


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
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    items: List[InvoiceItemCreate]
    signature_png_b64: Optional[str] = None


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
    created_by_user: Optional[UserOut] = None
    items: List[InvoiceItemOut]
    movements: List[MovementOut] = []
    override_requests: List[OverrideRequestOut] = []
    has_pending_override: bool = False

    model_config = ConfigDict(from_attributes=True)


class InvoiceListResponse(BaseModel):
    items: List[InvoiceOut]
    total: int
    page: int
    page_size: int


class OverrideDecision(BaseModel):
    admin_comment: Optional[str] = None