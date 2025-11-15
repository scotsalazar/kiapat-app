"""
Inventory routes exposing summary information and allowing IN movements
to be created, verified and committed.  Mutating operations are guarded
by the shared API key instead of per-user roles.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import auth, crud, models, schemas
from ..database import get_db
from ..errors import AppError, app_error_to_http


router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/summary", response_model=schemas.InventorySummary)
def inventory_summary(
    size: Optional[models.SizeEnum] = Query(None),
    color: Optional[models.ColorEnum] = Query(None),
    search: Optional[str] = Query(None),
    low_stock: bool = Query(False, alias="low_stock"),
    db: Session = Depends(get_db),
):
    """Return the current inventory balances per classification."""
    return crud.get_inventory_summary(
        db,
        size=size,
        color=color,
        search=search,
        low_stock_only=low_stock,
    )


@router.get("/thresholds", response_model=list[schemas.InventoryThresholdOut])
def inventory_thresholds(
    db: Session = Depends(get_db), _: None = Depends(auth.require_api_key)
):
    """Return configured low stock thresholds."""
    thresholds = crud.list_inventory_thresholds(db)
    return [schemas.InventoryThresholdOut.model_validate(t) for t in thresholds]


@router.put("/thresholds", response_model=list[schemas.InventoryThresholdOut])
def update_inventory_thresholds(
    payload: schemas.InventoryThresholdBulkUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
):
    """Update low stock thresholds."""
    try:
        thresholds = crud.set_inventory_thresholds(db, payload.thresholds)
    except AppError as exc:
        raise app_error_to_http(exc)
    return [schemas.InventoryThresholdOut.model_validate(t) for t in thresholds]


@router.get("/movements", response_model=list[schemas.MovementOut])
def list_inventory_movements(
    type: Optional[models.MovementType] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Return recent inventory movements, optionally filtered by type."""
    return crud.list_movements(db, movement_type=type, limit=limit)


@router.post("/in/create", response_model=schemas.MovementOut)
def create_in(
    movement: schemas.CreateInMovement,
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
):
    """Create a draft IN movement."""
    user = auth.get_service_user(db)
    return crud.create_in_movement(db, user, movement)


@router.post("/in/verify", response_model=schemas.MovementOut)
def verify_in(
    req: schemas.VerifyMovement,
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
):
    """Verify a draft IN movement."""
    try:
        user = auth.get_service_user(db)
        return crud.verify_movement(db, user, req.movement_id)
    except AppError as exc:
        raise app_error_to_http(exc)


@router.post("/in/commit", response_model=schemas.MovementOut)
def commit_in(
    req: schemas.CommitMovement,
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
):
    """Commit a verified IN movement."""
    try:
        user = auth.get_service_user(db)
        return crud.commit_movement(db, user, req.movement_id)
    except AppError as exc:
        raise app_error_to_http(exc)
