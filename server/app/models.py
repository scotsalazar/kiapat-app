"""
SQLAlchemy ORM models representing the Kiapat domain.  These models
mirror the data model described in the specification and include
relationships where appropriate.  Enumerations are used for
restricted fields such as egg size, shell color, units and user
roles.  Timestamps are stored as naive UTC datetimes; application
logic should handle timezone conversion on display.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Enum,
    DateTime,
    ForeignKey,
    Float,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from .database import Base


class RoleEnum(str, enum.Enum):
    ADMIN = "admin"
    DRIVER = "driver"


class SizeEnum(str, enum.Enum):
    S = "S"
    M = "M"
    L = "L"
    XL = "XL"


class ColorEnum(str, enum.Enum):
    WHITE = "WHITE"


class UnitEnum(str, enum.Enum):
    TRAY = "TRAY"
    DOZEN = "DOZEN"
    PCS = "PCS"


class MovementType(str, enum.Enum):
    IN = "IN"
    OUT = "OUT"


class MovementStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    VERIFIED = "VERIFIED"
    COMMITTED = "COMMITTED"
    PENDING_OVERRIDE = "PENDING_OVERRIDE"
    REJECTED = "REJECTED"


class InvoiceStatus(str, enum.Enum):
    COMPLETED = "COMPLETED"
    PENDING_OVERRIDE = "PENDING_OVERRIDE"
    REJECTED = "REJECTED"


class OverrideStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    movements = relationship("InventoryMovement", back_populates="by_user")
    invoices = relationship("Invoice", back_populates="created_by_user")


class Classification(Base):
    __tablename__ = "classifications"
    id = Column(Integer, primary_key=True, index=True)
    size = Column(Enum(SizeEnum), nullable=False)
    color = Column(Enum(ColorEnum), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    prices = relationship("Price", back_populates="classification")
    inventory_balance = relationship("InventoryBalance", uselist=False, back_populates="classification")
    movements = relationship("InventoryMovement", back_populates="classification")
    invoice_items = relationship("InvoiceItem", back_populates="classification")
    threshold = relationship("InventoryThreshold", uselist=False, back_populates="classification")

    __table_args__ = (UniqueConstraint("size", "color", name="uq_classifications_size_color"),)


class Price(Base):
    __tablename__ = "prices"
    id = Column(Integer, primary_key=True, index=True)
    classification_id = Column(Integer, ForeignKey("classifications.id"), nullable=False)
    unit = Column(Enum(UnitEnum), nullable=False)
    price_per_unit = Column(Float, nullable=False)
    effective_from = Column(DateTime, nullable=False, default=datetime.utcnow)
    effective_to = Column(DateTime, nullable=True)

    classification = relationship("Classification", back_populates="prices")


class InventoryBalance(Base):
    __tablename__ = "inventory_balances"
    classification_id = Column(Integer, ForeignKey("classifications.id"), primary_key=True)
    qty_pcs = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow)

    classification = relationship("Classification", back_populates="inventory_balance")


class InventoryThreshold(Base):
    __tablename__ = "inventory_thresholds"
    classification_id = Column(Integer, ForeignKey("classifications.id"), primary_key=True)
    threshold_pcs = Column(Integer, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    classification = relationship("Classification", back_populates="threshold")


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(MovementType), nullable=False)
    classification_id = Column(Integer, ForeignKey("classifications.id"), nullable=False)
    qty_pcs = Column(Integer, nullable=False)
    unit_entered = Column(Enum(UnitEnum), nullable=False)
    qty_entered = Column(Integer, nullable=False)
    by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(MovementStatus), nullable=False, default=MovementStatus.DRAFT)
    linked_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    committed_at = Column(DateTime, nullable=True)

    classification = relationship("Classification", back_populates="movements")
    by_user = relationship("User", back_populates="movements")
    invoice = relationship("Invoice", back_populates="movements")


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    gps_coordinates = Column(String, nullable=True)
    total_amount = Column(Float, nullable=False)
    signature_png_path = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(InvoiceStatus), nullable=False, default=InvoiceStatus.COMPLETED)

    created_by_user = relationship("User", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice")
    movements = relationship("InventoryMovement", back_populates="invoice")
    overrides = relationship("InvoiceOverride", back_populates="invoice")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    classification_id = Column(Integer, ForeignKey("classifications.id"), nullable=False)
    unit = Column(Enum(UnitEnum), nullable=False)
    qty = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    line_total = Column(Float, nullable=False)

    invoice = relationship("Invoice", back_populates="items")
    classification = relationship("Classification", back_populates="invoice_items")


class InvoiceOverride(Base):
    __tablename__ = "invoice_overrides"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    classification_id = Column(Integer, ForeignKey("classifications.id"), nullable=False)
    requested_qty_pcs = Column(Integer, nullable=False)
    requested_unit = Column(Enum(UnitEnum), nullable=False, default=UnitEnum.PCS)
    available_qty_pcs = Column(Integer, nullable=False)
    status = Column(Enum(OverrideStatus), nullable=False, default=OverrideStatus.PENDING)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    decided_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    decision_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)

    invoice = relationship("Invoice", back_populates="overrides")
    classification = relationship("Classification")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    decided_by = relationship("User", foreign_keys=[decided_by_id])