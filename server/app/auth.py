"""Authentication helpers for password hashing and JWT handling."""

from __future__ import annotations

import os
import re
import secrets
from datetime import datetime, timedelta
from typing import Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import models, schemas
from .database import get_db


pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    default="pbkdf2_sha256",
    deprecated="auto",
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

SECRET_KEY = os.getenv("SECRET_KEY", "change-me")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
API_SHARED_SECRET = os.getenv("API_SHARED_SECRET")
try:
    # Default to 24 hours so tokens used by the mobile app remain valid during a
    # full day of deliveries instead of expiring after just one hour.
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(24 * 60)))
except ValueError:
    ACCESS_TOKEN_EXPIRE_MINUTES = 24 * 60


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


def get_user(db: Session, username: str) -> models.User | None:
    """Fetch a user by username."""

    return db.query(models.User).filter(models.User.username == username).first()


def authenticate_user(db: Session, username: str, password: str) -> models.User | None:
    """Return the user when credentials are valid."""

    user = get_user(db, username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Encode a JWT with the provided payload."""

    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    api_key: str | None = Depends(api_key_header),
    db: Session = Depends(get_db),
) -> models.User:
    """Dependency returning the authenticated user from a bearer token."""

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError:
            raise credentials_exception
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username, role=payload.get("role"))
        user = get_user(db, token_data.username)
        if user is None:
            raise credentials_exception
        return user

    if API_SHARED_SECRET and api_key:
        if secrets.compare_digest(api_key, API_SHARED_SECRET):
            user = db.query(models.User).filter(models.User.role == models.RoleEnum.ADMIN).first()
            if user:
                return user
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Admin user not provisioned")
        raise credentials_exception

    raise credentials_exception


def get_current_active_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    """Dependency used by routers to ensure the user exists."""

    return current_user


def ensure_role(user: models.User, allowed_roles: Iterable[models.RoleEnum]) -> None:
    """Raise an HTTP 403 error when the user does not have one of the roles."""

    allowed = {role.value if isinstance(role, models.RoleEnum) else role for role in allowed_roles}
    if user.role.value not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
