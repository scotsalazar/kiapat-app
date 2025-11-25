"""Centralized error helpers for returning structured API responses."""

from __future__ import annotations

from enum import Enum
from typing import Any

from fastapi import HTTPException, status

from .schemas import ErrorResponse


class ErrorCode(str, Enum):
    """Enumeration of application error codes returned by the API."""

    COMMON_VALIDATION_ERROR = "common:validation_error"
    COMMON_NOT_FOUND = "common:not_found"
    USERS_USERNAME_EXISTS = "users:username_exists"
    USERS_EMAIL_EXISTS = "users:email_exists"
    USERS_NOT_FOUND = "users:not_found"
    CATALOG_DUPLICATE = "catalog:duplicate_classification"
    CATALOG_NOT_FOUND = "catalog:not_found"
    CATALOG_DELETE_CONFLICT = "catalog:delete_conflict"
    PRICING_INVALID_RANGE = "pricing:invalid_range"
    PRICING_OVERLAP = "pricing:overlap"
    PRICING_NOT_FOUND = "pricing:not_found"
    SALES_EMPTY_INVOICE = "sales:empty_invoice"
    SALES_PRICE_MISSING = "sales:price_missing"
    SALES_NOT_FOUND = "sales:not_found"
    SALES_INVALID_STATE = "sales:invalid_state"
    INVENTORY_INVALID_STATE = "inventory:invalid_state"
    INVENTORY_INSUFFICIENT_STOCK = "inventory:insufficient_stock"


class AppError(Exception):
    """Domain level error that can be converted to an HTTPException."""

    def __init__(
        self,
        code: ErrorCode | str,
        message: str,
        *,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Any | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def _error_payload(code: ErrorCode | str, message: str, *, details: Any | None = None) -> dict[str, Any]:
    payload = ErrorResponse(code=str(code), message=message, details=details)
    return payload.model_dump(exclude_none=True)


def http_exception(
    status_code: int,
    code: ErrorCode | str,
    message: str,
    *,
    details: Any | None = None,
) -> HTTPException:
    """Create an HTTPException with the shared error response payload."""

    return HTTPException(status_code=status_code, detail=_error_payload(code, message, details=details))


def app_error_to_http(error: AppError) -> HTTPException:
    """Convert an AppError into an HTTPException for FastAPI."""

    return http_exception(error.status_code, error.code, error.message, details=error.details)


def not_found(
    message: str = "Resource not found",
    *,
    code: ErrorCode = ErrorCode.COMMON_NOT_FOUND,
    details: Any | None = None,
) -> HTTPException:
    return http_exception(status.HTTP_404_NOT_FOUND, code, message, details=details)


def validation_error(
    message: str,
    *,
    code: ErrorCode = ErrorCode.COMMON_VALIDATION_ERROR,
    details: Any | None = None,
) -> HTTPException:
    return http_exception(status.HTTP_400_BAD_REQUEST, code, message, details=details)
