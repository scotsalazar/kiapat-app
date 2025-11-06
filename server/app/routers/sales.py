"""
Sales routes for creating and retrieving invoices.  Creating a sales
invoice will decrement inventory and create OUT movements.  Only
drivers can create invoices.  Admins may list all invoices.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import auth, crud, models, schemas
from ..database import get_db


router = APIRouter(prefix="/api/sales/invoices", tags=["sales"])


@router.post("", response_model=schemas.InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice(
    invoice_in: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Create a new sales invoice.  Only drivers may create invoices."""
    if current_user.role != models.RoleEnum.DRIVER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only drivers can create invoices")
    try:
        invoice = crud.create_invoice(db, current_user, invoice_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """List invoices.  Drivers see only their invoices; admins see all."""
    if end_date and start_date and end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be on or after start_date",
        )

    invoices, total = crud.list_invoices(
        db,
        current_user,
        page=page,
        page_size=page_size,
        start_date=start_date,
        end_date=end_date,
        customer=customer,
        driver=driver,
        status=status,
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
    """Retrieve a single invoice by id.  Drivers may only retrieve their own invoices."""
    invoice = crud.get_invoice(db, invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if current_user.role == models.RoleEnum.DRIVER and invoice.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this invoice")
    return invoice