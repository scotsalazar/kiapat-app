"""Administrative user management routes."""

from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from .. import auth, crud, schemas
from ..database import get_db
from ..errors import AppError, app_error_to_http, validation_error


router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=List[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
):
    return crud.list_users(db)


@router.post("/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: schemas.UserCreate,
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
):
    try:
        auth.ensure_password_complexity(user_in.password)
        return crud.create_user(db, user_in)
    except AppError as exc:
        raise app_error_to_http(exc)
    except ValueError as exc:
        raise validation_error(str(exc))


@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    user_in: schemas.UserUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
):
    try:
        return crud.update_user(db, user_id, user_in)
    except AppError as exc:
        raise app_error_to_http(exc)
    except ValueError as exc:
        raise validation_error(str(exc))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
):
    try:
        crud.delete_user(db, user_id)
    except AppError as exc:
        raise app_error_to_http(exc)
    except ValueError as exc:
        raise validation_error(str(exc))


@router.post("/{user_id}/reset-password", response_model=schemas.UserOut)
def reset_password(
    user_id: int,
    payload: schemas.PasswordResetRequest,
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
):
    try:
        auth.ensure_password_complexity(payload.new_password)
        return crud.reset_user_password(db, user_id, payload.new_password)
    except AppError as exc:
        raise app_error_to_http(exc)
    except ValueError as exc:
        raise validation_error(str(exc))
