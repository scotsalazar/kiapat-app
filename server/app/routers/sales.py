"""
Sales routes for creating and retrieving invoices.  Creating a sales
invoice will decrement inventory and create OUT movements.  Access is
now guarded by the shared API key rather than per-user roles.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from .. import auth, crud, models, schemas
from ..database import get_db
from ..errors import AppError, ErrorCode, app_error_to_http, not_found, validation_error


router = APIRouter(prefix="/api/sales/invoices", tags=["sales"])


@router.post("", response_model=schemas.InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice(
    invoice_in: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Create a new sales invoice."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN, models.RoleEnum.DRIVER])
    try:
        invoice = crud.create_invoice(db, current_user, invoice_in)
    except AppError as exc:
        raise app_error_to_http(exc)
    return invoice


@router.get("/overrides/pending", response_model=List[schemas.InvoiceOverrideOut])
def list_overrides(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """List all pending override requests."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    return crud.list_pending_overrides(db)


@router.post("/{invoice_id}/override/approve", response_model=schemas.InvoiceOut)
def approve_override(
    invoice_id: int,
    decision: Optional[schemas.OverrideDecision] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Approve a pending override request."""

    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        invoice = crud.approve_invoice_override(
            db,
            current_user,
            invoice_id,
            (decision.decision_reason if decision else None),
        )
    except AppError as exc:
        raise app_error_to_http(exc)
    return invoice


@router.post("/{invoice_id}/override/reject", response_model=schemas.InvoiceOut)
def reject_override(
    invoice_id: int,
    decision: Optional[schemas.OverrideDecision] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Reject a pending override request."""

    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        invoice = crud.reject_invoice_override(
            db,
            current_user,
            invoice_id,
            (decision.decision_reason if decision else None),
        )
    except AppError as exc:
        raise app_error_to_http(exc)
    return invoice


@router.get("", response_model=schemas.InvoiceListResponse)
def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    customer: Optional[str] = None,
    driver: Optional[str] = None,
    status: Optional[models.MovementStatus] = None,
    invoice_status: Optional[models.InvoiceStatus] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """List invoices."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN, models.RoleEnum.DRIVER])
    if end_date and start_date and end_date < start_date:
        raise validation_error("end_date must be on or after start_date")

    driver_filter = driver
    if current_user.role == models.RoleEnum.DRIVER:
        driver_filter = current_user.username

    invoices, total = crud.list_invoices(
        db,
        page=page,
        page_size=page_size,
        start_date=start_date,
        end_date=end_date,
        customer=customer,
        driver=driver_filter,
        status=status,
        invoice_status=invoice_status,
    )
    return schemas.InvoiceListResponse(
        items=invoices,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{invoice_id}", response_model=schemas.InvoiceOut)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Retrieve a single invoice by id."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN, models.RoleEnum.DRIVER])
    invoice = (
        db.query(models.Invoice)
        .options(
            selectinload(models.Invoice.items).selectinload(models.InvoiceItem.classification),
            selectinload(models.Invoice.created_by_user),
            selectinload(models.Invoice.overrides),
        )
        .filter(models.Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise not_found("Invoice not found", code=ErrorCode.SALES_NOT_FOUND, details={"invoice_id": invoice_id})
    if current_user.role == models.RoleEnum.DRIVER and invoice.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return invoice


@router.post("/{invoice_id}/reprint", response_model=schemas.InvoiceOut)
def reprint_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Record an invoice reprint and return the invoice details."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN, models.RoleEnum.DRIVER])
    try:
        return crud.record_invoice_reprint(db, current_user, invoice_id)
    except AppError as exc:
        raise app_error_to_http(exc)
