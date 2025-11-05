"""
Catalog routes for listing egg classifications and pricing.  Currently
only GET endpoints are implemented; creation and modification of
classifications/prices could be added here with proper authorization.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import auth, crud, schemas, models
from ..database import get_db


router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/classifications", response_model=list[schemas.ClassificationOut])
def get_classifications(
    db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)
):
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
    """Create a new classification. Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        return crud.create_classification(db, classification)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.put("/classifications/{classification_id}", response_model=schemas.ClassificationOut)
def update_classification(
    classification_id: int,
    classification: schemas.ClassificationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Update an existing classification. Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        return crud.update_classification(db, classification_id, classification)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/classifications/{classification_id}/activate", response_model=schemas.ClassificationOut)
def activate_classification(
    classification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Activate a classification. Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        return crud.set_classification_active(db, classification_id, True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/classifications/{classification_id}/deactivate", response_model=schemas.ClassificationOut)
def deactivate_classification(
    classification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Deactivate a classification. Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        return crud.set_classification_active(db, classification_id, False)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/classifications/{classification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_classification(
    classification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Delete a classification. Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        crud.delete_classification(db, classification_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/prices", response_model=list[schemas.PriceOut])
def get_prices(
    db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)
):
    """Return all price entries."""
    return crud.list_prices(db)


@router.post("/prices", response_model=schemas.PriceOut, status_code=status.HTTP_201_CREATED)
def create_price(
    price: schemas.PriceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Create a price entry. Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        return crud.create_price(db, price)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.put("/prices/{price_id}", response_model=schemas.PriceOut)
def update_price(
    price_id: int,
    price: schemas.PriceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Update a price entry. Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        return crud.update_price(db, price_id, price)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/prices/{price_id}/activate", response_model=schemas.PriceOut)
def activate_price(
    price_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Activate a price entry. Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        return crud.activate_price(db, price_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/prices/{price_id}/deactivate", response_model=schemas.PriceOut)
def deactivate_price(
    price_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Deactivate a price entry. Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        return crud.deactivate_price(db, price_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/prices/{price_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_price(
    price_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Delete a price entry. Requires admin role."""
    if current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        crud.delete_price(db, price_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return Response(status_code=status.HTTP_204_NO_CONTENT)