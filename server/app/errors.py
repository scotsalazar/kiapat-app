"""Common error helpers and exceptions for API responses."""

from __future__ import annotations

from typing import Any, NoReturn

from fastapi import HTTPException, status

from .schemas import ErrorResponse


def _build_error_payload(code: str, message: str, *, details: Any = None) -> dict[str, Any]:
    """Return a dictionary matching :class:`schemas.ErrorResponse`."""

    payload = ErrorResponse(code=code, message=message, details=details)
    return payload.model_dump(exclude_none=True)


class AppError(Exception):
    """Domain-level error that can be translated into an HTTP response."""

    def __init__(
        self,
        code: str,
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


def raise_http_error(
    status_code: int, code: str, message: str, *, details: Any | None = None
) -> NoReturn:
    """Raise an :class:`fastapi.HTTPException` with a structured payload."""

    raise HTTPException(
        status_code=status_code,
        detail=_build_error_payload(code, message, details=details),
    )


def raise_from_app_error(error: AppError) -> NoReturn:
    """Translate an :class:`AppError` into an HTTP exception and raise it."""

    raise HTTPException(
        status_code=error.status_code,
        detail=_build_error_payload(error.code, error.message, details=error.details),
    )


__all__ = ["AppError", "raise_http_error", "raise_from_app_error"]
