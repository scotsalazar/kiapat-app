"""Product management endpoints for managing catalog items and default pricing."""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from .. import auth, crud, models, schemas
from ..database import get_db
from ..errors import AppError, app_error_to_http

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/", response_model=list[schemas.ProductOut])
def list_products(
    db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)
):
    """List all products with their current default prices."""
    return crud.list_products(db)


@router.post("/", response_model=schemas.ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    product: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Create a new product with default pricing."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        return crud.create_product(db, product)
    except AppError as exc:
        raise app_error_to_http(exc)


@router.put("/{product_id}", response_model=schemas.ProductOut)
def update_product(
    product_id: int,
    product: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Update a product's details or default prices."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        return crud.update_product(db, product_id, product)
    except AppError as exc:
        raise app_error_to_http(exc)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Deactivate a product and close out its prices."""
    auth.ensure_role(current_user, [models.RoleEnum.ADMIN])
    try:
        crud.delete_product(db, product_id)
    except AppError as exc:
        raise app_error_to_http(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
