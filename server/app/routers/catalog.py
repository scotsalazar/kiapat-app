"""
Catalog routes for listing egg classifications and pricing.  Currently
only GET endpoints are implemented; creation and modification of
classifications/prices could be added here with proper authorization.
"""

from fastapi import APIRouter, Depends
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


@router.get("/prices", response_model=list[schemas.PriceOut])
def get_prices(
    db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)
):
    """Return all price entries."""
    return crud.list_prices(db)