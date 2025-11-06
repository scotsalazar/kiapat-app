"""
Inventory routes exposing summary information and allowing IN movements
to be created, verified and committed.  Only users with the admin
role may verify and commit inventory movements.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from .. import auth, crud, models, schemas
from ..database import get_db


router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/summary", response_model=schemas.InventorySummary)
def inventory_summary(
    db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)
):
    """Return the current inventory balances per classification."""
    return crud.get_inventory_summary(db)


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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        return crud.verify_movement(db, current_user, req.movement_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/in/commit", response_model=schemas.MovementOut)
def commit_in(
    req: schemas.CommitMovement,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Commit a verified IN movement.  Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        return crud.commit_movement(db, current_user, req.movement_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/overrides", response_model=list[schemas.OverrideRequestOut])
def list_overrides(
    status_filter: Optional[models.OverrideStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return crud.list_override_requests(db, status=status_filter)


@router.post("/overrides/{override_id}/approve", response_model=schemas.OverrideRequestOut)
def approve_override(
    override_id: int,
    decision: schemas.OverrideDecision = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        comment = decision.admin_comment if decision else None
        return crud.approve_override_request(db, current_user, override_id, admin_comment=comment)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/overrides/{override_id}/reject", response_model=schemas.OverrideRequestOut)
def reject_override(
    override_id: int,
    decision: schemas.OverrideDecision = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        comment = decision.admin_comment if decision else None
        return crud.reject_override_request(db, current_user, override_id, admin_comment=comment)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))