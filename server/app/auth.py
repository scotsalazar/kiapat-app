"""
Simplified authentication utilities for FastAPI.  The application no
longer performs OAuth2/JWT token exchanges; instead, write endpoints
can be guarded by a shared API key header.  Password hashing helpers
remain so that user management keeps functioning.
"""

from __future__ import annotations

import os
import re

from fastapi import Header, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import models


# Password hashing configuration
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    default="pbkdf2_sha256",
    deprecated="auto",
)

API_SHARED_SECRET = os.getenv("API_SHARED_SECRET", "")
SERVICE_USERNAME = os.getenv("API_SERVICE_USERNAME", "admin")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password."""

    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a plain password."""

    return pwd_context.hash(password)


def ensure_password_complexity(password: str) -> None:
    """Validate that the password meets baseline complexity requirements."""

    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one digit")


def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    """Dependency that validates the shared API key header.

    When ``API_SHARED_SECRET`` is not defined the dependency becomes a
    no-op so the application can continue to run in development
    environments.
    """

    if not API_SHARED_SECRET:
        return
    if x_api_key != API_SHARED_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )


def get_service_user(db: Session) -> models.User:
    """Return a deterministic user record for system initiated actions."""

    query = db.query(models.User)
    user = None
    if SERVICE_USERNAME:
        user = query.filter(models.User.username == SERVICE_USERNAME).first()
    if not user:
        user = query.order_by(models.User.id.asc()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No users available for system operations",
        )
    return user
