"""
Catalog routes for listing egg classifications and pricing.  Currently
only GET endpoints are implemented; creation and modification of
classifications/prices could be added here with proper authorization.
"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from .. import auth, crud, models, schemas
from ..database import get_db
from ..errors import AppError, app_error_to_http


router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/classifications", response_model=list[schemas.ClassificationOut])
def get_classifications(db: Session = Depends(get_db)):
    """Return all active egg classifications."""
    return crud.list_classifications(db)


@router.post(
    "/classifications",
    response_model=schemas.ClassificationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_classification(
    classification: schemas.ClassificationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Create a new classification."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        return crud.create_classification(db, classification)
    except AppError as exc:
        raise app_error_to_http(exc)


@router.put("/classifications/{classification_id}", response_model=schemas.ClassificationOut)
def update_classification(
    classification_id: int,
    classification: schemas.ClassificationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Update an existing classification."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        return crud.update_classification(db, classification_id, classification)
    except AppError as exc:
        raise app_error_to_http(exc)


@router.post("/classifications/{classification_id}/activate", response_model=schemas.ClassificationOut)
def activate_classification(
    classification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Activate a classification."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        return crud.set_classification_active(db, classification_id, True)
    except AppError as exc:
        raise app_error_to_http(exc)


@router.post("/classifications/{classification_id}/deactivate", response_model=schemas.ClassificationOut)
def deactivate_classification(
    classification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Deactivate a classification."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        return crud.set_classification_active(db, classification_id, False)
    except AppError as exc:
        raise app_error_to_http(exc)


@router.delete("/classifications/{classification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_classification(
    classification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Delete a classification."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        crud.delete_classification(db, classification_id)
    except AppError as exc:
        raise app_error_to_http(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/prices", response_model=list[schemas.PriceOut])
def get_prices(db: Session = Depends(get_db)):
    """Return all price entries."""
    return crud.list_prices(db)


@router.post("/prices", response_model=schemas.PriceOut, status_code=status.HTTP_201_CREATED)
def create_price(
    price: schemas.PriceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Create a price entry."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        return crud.create_price(db, price)
    except AppError as exc:
        raise app_error_to_http(exc)


@router.put("/prices/{price_id}", response_model=schemas.PriceOut)
def update_price(
    price_id: int,
    price: schemas.PriceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Update a price entry."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        return crud.update_price(db, price_id, price)
    except AppError as exc:
        raise app_error_to_http(exc)


@router.post("/prices/{price_id}/activate", response_model=schemas.PriceOut)
def activate_price(
    price_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Activate a price entry."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        return crud.activate_price(db, price_id)
    except AppError as exc:
        raise app_error_to_http(exc)


@router.post("/prices/{price_id}/deactivate", response_model=schemas.PriceOut)
def deactivate_price(
    price_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Deactivate a price entry."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        return crud.deactivate_price(db, price_id)
    except AppError as exc:
        raise app_error_to_http(exc)


@router.delete("/prices/{price_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_price(
    price_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Delete a price entry."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        crud.delete_price(db, price_id)
    except AppError as exc:
        raise app_error_to_http(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)