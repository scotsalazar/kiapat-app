"""
Inventory routes exposing summary information and allowing IN movements
to be created, verified and committed.  Only users with the admin
role may verify and commit inventory movements.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import auth, crud, models, schemas
from ..database import get_db
from ..errors import AppError, app_error_to_http, forbidden


router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/summary", response_model=schemas.InventorySummary)
def inventory_summary(
    db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)
):
    """Return the current inventory balances per classification."""
    return crud.get_inventory_summary(db)


@router.get("/thresholds", response_model=list[schemas.InventoryThresholdOut])
def inventory_thresholds(
    db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)
):
    """Return configured low stock thresholds. Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise forbidden("Only admins can view inventory thresholds")
    thresholds = crud.list_inventory_thresholds(db)
    return [schemas.InventoryThresholdOut.model_validate(t) for t in thresholds]


@router.put("/thresholds", response_model=list[schemas.InventoryThresholdOut])
def update_inventory_thresholds(
    payload: schemas.InventoryThresholdBulkUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Update low stock thresholds. Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise forbidden("Only admins can update inventory thresholds")
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
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Return recent inventory movements, optionally filtered by type."""
    return crud.list_movements(db, movement_type=type, limit=limit)


@router.post("/in/create", response_model=schemas.MovementOut)
def create_in(
    movement: schemas.CreateInMovement,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Create a draft IN movement."""
    return crud.create_in_movement(db, current_user, movement)


@router.post("/in/verify", response_model=schemas.MovementOut)
def verify_in(
    req: schemas.VerifyMovement,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Verify a draft IN movement.  Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise forbidden("Not authorized to verify inventory movements")
    try:
        return crud.verify_movement(db, current_user, req.movement_id)
    except AppError as exc:
        raise app_error_to_http(exc)


@router.post("/in/commit", response_model=schemas.MovementOut)
def commit_in(
    req: schemas.CommitMovement,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Commit a verified IN movement.  Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise forbidden("Not authorized to commit inventory movements")
    try:
        return crud.commit_movement(db, current_user, req.movement_id)
    except AppError as exc:
        raise app_error_to_http(exc)
