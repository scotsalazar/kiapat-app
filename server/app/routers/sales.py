"""
Sales routes for creating and retrieving invoices.  Creating a sales
invoice will decrement inventory and create OUT movements.  Only
drivers can create invoices.  Admins may list all invoices.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
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


@router.get("", response_model=List[schemas.InvoiceOut])
def list_invoices(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """List invoices.  Drivers see only their invoices; admins see all."""
    query = db.query(models.Invoice).order_by(models.Invoice.created_at.desc())
    if current_user.role == models.RoleEnum.DRIVER:
        query = query.filter(models.Invoice.created_by == current_user.id)
    invoices = query.all()
    return invoices


@router.get("/{invoice_id}", response_model=schemas.InvoiceOut)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Retrieve a single invoice by id.  Drivers may only retrieve their own invoices."""
    invoice = db.query(models.Invoice).get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if current_user.role == models.RoleEnum.DRIVER and invoice.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this invoice")
    return invoice