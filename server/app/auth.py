"""
Authentication utilities for FastAPI.  This module handles password
hashing, verification, JWT creation and token decoding.  It exposes
a dependency `get_current_user` that can be used in route handlers to
protect endpoints and provide access to the authenticated user.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
import re
from typing import Optional

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import models, schemas
from .database import get_db


# Password hashing configuration
# Use PBKDF2-SHA256 as the default but allow verifying existing bcrypt hashes.
# PBKDF2 avoids backend issues on some platforms (bcrypt requires a compiled
# extension and may cause errors like 'module bcrypt has no attribute
# __about__' on Python 3.13) while the inclusion of bcrypt ensures legacy
# hashes continue to validate.
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    default="pbkdf2_sha256",
    deprecated="auto",
)

# OAuth2 password flow will use this endpoint; the token will be returned
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# JWT configuration
SECRET_KEY = os.getenv("JWT_SECRET", "CHANGE_ME_PLEASE")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # one day validity


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a plain password."""
    return pwd_context.hash(password)


def ensure_password_complexity(password: str) -> None:
    """Validate that the password meets baseline complexity requirements.

    The rules enforce a minimum length and the presence of uppercase,
    lowercase and numeric characters.  A ``ValueError`` is raised when the
    password fails validation so that callers can translate it into an
    appropriate HTTP error response.
    """

    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one digit")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token containing the provided data payload."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def authenticate_user(db: Session, username: str, password: str) -> Optional[models.User]:
    """Authenticate a user by username and password.  Returns None if the
    credentials are invalid or the user does not exist."""
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if pwd_context.needs_update(user.hashed_password):
        user.hashed_password = get_password_hash(password)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    """Dependency that returns the current authenticated user based on the
    provided JWT token.  Raises HTTP 401 if the token is invalid or
    expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")  # subject
        role: str = payload.get("role")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username, role=role)
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    """Convenience dependency that returns the currently authenticated user.
    Could be extended to enforce user activation/lockout rules.
    """
    return current_user