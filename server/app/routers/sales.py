"""
Sales routes for creating and retrieving invoices.  Creating a sales
invoice will decrement inventory and create OUT movements.  Access is
now guarded by the shared API key rather than per-user roles.
"""

from datetime import datetime
from io import BytesIO
from typing import List, Optional
from zipfile import ZIP_DEFLATED, ZipFile
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload

from .. import auth, crud, models, schemas
from ..timezone import now_ph
from ..database import get_db
from ..errors import AppError, ErrorCode, app_error_to_http, not_found, validation_error


router = APIRouter(prefix="/api/sales/invoices", tags=["sales"])


CONTENT_TYPES_XML = """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">
  <Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>
  <Default Extension=\"xml\" ContentType=\"application/xml\"/>
  <Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>
  <Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>
  <Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>
</Types>
"""

RELS_XML = """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>
</Relationships>
"""

WORKBOOK_RELS_XML = """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>
  <Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>
</Relationships>
"""

WORKBOOK_XML = """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">
  <sheets>
    <sheet name=\"Sales Invoices\" sheetId=\"1\" r:id=\"rId1\"/>
  </sheets>
</workbook>
"""

STYLES_XML = """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">
  <fonts count=\"1\"><font/></fonts>
  <fills count=\"1\"><fill/></fills>
  <borders count=\"1\"><border/></borders>
  <cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>
  <cellXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/></cellXfs>
</styleSheet>
"""


def _column_letter(index: int) -> str:
    """Convert a 1-indexed column number to its Excel column label."""

    label = ""
    current = index
    while current > 0:
        current, remainder = divmod(current - 1, 26)
        label = chr(65 + remainder) + label
    return label or "A"


def _build_sheet_xml(headers: List[str], rows: List[List[str]]) -> str:
    """Serialize rows into minimal worksheet XML using inline strings."""

    all_rows = [headers, *rows]
    row_xml: List[str] = []
    for row_idx, row in enumerate(all_rows, start=1):
        cells: List[str] = []
        for col_idx, value in enumerate(row, start=1):
            ref = f"{_column_letter(col_idx)}{row_idx}"
            if value is None or value == "":
                cells.append(f'<c r="{ref}"/>')
                continue
            if isinstance(value, (int, float)):
                cells.append(f'<c r="{ref}"><v>{value}</v></c>')
                continue
            safe_value = escape(str(value))
            cells.append(
                f'<c r="{ref}" t="inlineStr"><is><t>{safe_value}</t></is></c>'
            )
        row_xml.append(f'<row r="{row_idx}">' + "".join(cells) + "</row>")

    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f"<sheetData>{''.join(row_xml)}</sheetData>"
        "</worksheet>"
    )


def _build_workbook(sheet_xml: str) -> BytesIO:
    """Package worksheet XML into a minimal XLSX archive."""

    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", CONTENT_TYPES_XML)
        archive.writestr("_rels/.rels", RELS_XML)
        archive.writestr("xl/_rels/workbook.xml.rels", WORKBOOK_RELS_XML)
        archive.writestr("xl/workbook.xml", WORKBOOK_XML)
        archive.writestr("xl/styles.xml", STYLES_XML)
        archive.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    output.seek(0)
    return output


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


@router.get("/export")
def export_invoices(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    customer: Optional[str] = None,
    driver: Optional[str] = None,
    status: Optional[models.MovementStatus] = None,
    invoice_status: Optional[models.InvoiceStatus] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Generate an XLSX export of invoices matching the current filters."""

    auth.ensure_role(current_user, [models.RoleEnum.ADMIN, models.RoleEnum.DRIVER])
    if end_date and start_date and end_date < start_date:
        raise validation_error("end_date must be on or after start_date")

    driver_filter = driver
    if current_user.role == models.RoleEnum.DRIVER:
        driver_filter = current_user.username

    invoices = crud.get_invoices(
        db,
        start_date=start_date,
        end_date=end_date,
        customer=customer,
        driver=driver_filter,
        status=status,
        invoice_status=invoice_status,
    )

    headers = [
        "Invoice ID",
        "Created",
        "Customer",
        "Phone",
        "Location",
        "Driver",
        "Status",
        "Total Amount",
    ]

    rows: List[List[str]] = []
    for invoice in invoices:
        driver_name = None
        if invoice.created_by_user:
            driver_name = invoice.created_by_user.name or invoice.created_by_user.username
        driver_name = driver_name or f"#{invoice.created_by}"
        rows.append(
            [
                invoice.id,
                invoice.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                invoice.customer_name or "Walk-in",
                invoice.customer_phone or "",
                invoice.gps_coordinates or "",
                driver_name,
                invoice.status.value.replace("_", " ").title(),
                float(invoice.total_amount),
            ]
        )

    sheet_xml = _build_sheet_xml(headers, rows)
    output = _build_workbook(sheet_xml)
    filename = f"sales-invoices-{now_ph().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
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
