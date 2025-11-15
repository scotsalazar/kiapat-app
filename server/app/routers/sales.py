"""
Sales routes for creating and retrieving invoices.  Creating a sales
invoice will decrement inventory and create OUT movements.  Access is
now guarded by the shared API key rather than per-user roles.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from .. import auth, crud, models, schemas
from ..database import get_db
from ..errors import AppError, ErrorCode, app_error_to_http, not_found, validation_error


router = APIRouter(prefix="/api/sales/invoices", tags=["sales"])


@router.post("", response_model=schemas.InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice(
    invoice_in: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
):
    """Create a new sales invoice."""
    try:
        user = auth.get_service_user(db)
        invoice = crud.create_invoice(db, user, invoice_in)
    except AppError as exc:
        raise app_error_to_http(exc)
    return invoice


@router.get("/overrides/pending", response_model=List[schemas.InvoiceOverrideOut])
def list_overrides(
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
):
    """List all pending override requests."""
    return crud.list_pending_overrides(db)


@router.post("/{invoice_id}/override/approve", response_model=schemas.InvoiceOut)
def approve_override(
    invoice_id: int,
    decision: Optional[schemas.OverrideDecision] = None,
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
):
    """Approve a pending override request."""

    try:
        user = auth.get_service_user(db)
        invoice = crud.approve_invoice_override(
            db, user, invoice_id, (decision.decision_reason if decision else None)
        )
    except AppError as exc:
        raise app_error_to_http(exc)
    return invoice


@router.post("/{invoice_id}/override/reject", response_model=schemas.InvoiceOut)
def reject_override(
    invoice_id: int,
    decision: Optional[schemas.OverrideDecision] = None,
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
):
    """Reject a pending override request."""

    try:
        user = auth.get_service_user(db)
        invoice = crud.reject_invoice_override(
            db, user, invoice_id, (decision.decision_reason if decision else None)
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
    _: None = Depends(auth.require_api_key),
):
    """List invoices."""
    if end_date and start_date and end_date < start_date:
        raise validation_error("end_date must be on or after start_date")

    invoices, total = crud.list_invoices(
        db,
        page=page,
        page_size=page_size,
        start_date=start_date,
        end_date=end_date,
        customer=customer,
        driver=driver,
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
    _: None = Depends(auth.require_api_key),
):
    """Retrieve a single invoice by id."""
    invoice = db.query(models.Invoice).get(invoice_id)
    if not invoice:
        raise not_found("Invoice not found", code=ErrorCode.SALES_NOT_FOUND, details={"invoice_id": invoice_id})
    return invoice
