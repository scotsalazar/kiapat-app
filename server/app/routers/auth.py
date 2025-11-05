"""
Authentication routes for the API.  Provides login and current-user
retrieval endpoints.  Uses JWT for stateless authentication.
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import auth, crud, models, schemas
from ..database import get_db


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticate a user and return a JWT access token."""
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user.role.value},
        expires_delta=timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return schemas.Token(access_token=access_token)


@router.get("/me", response_model=schemas.UserOut)
async def read_users_me(
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Return the currently authenticated user's profile."""
    return current_user