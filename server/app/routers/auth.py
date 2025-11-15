"""Placeholder module for backwards compatibility.

The application no longer exposes OAuth2/JWT login endpoints.  Clients
should instead supply the ``X-API-Key`` header (matching the
``API_SHARED_SECRET`` environment variable) when invoking protected
routes.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/info")
def auth_info() -> dict[str, str]:
    """Explain the simplified authentication approach."""

    return {
        "authentication": "Shared secret only",
        "header": "X-API-Key",
        "environment_variable": "API_SHARED_SECRET",
    }
