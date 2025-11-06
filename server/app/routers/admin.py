"""
Administrative routes for seeding the database and health checks.  The
seed endpoint should be called once on first deployment to create
initial users, classifications and prices.  It is guarded by an
environment variable `SEED_TOKEN` to prevent accidental reseeding.
"""

import os
from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from .. import auth, models, utils, seeder
from ..database import get_db
from ..errors import forbidden


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/health")
def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"}


@router.post("/seed")
def seed(
    db: Session = Depends(get_db),
    seed_token: str = Header(default=""),
):
    """Seed the database with initial data.  Must provide the correct
    `SEED_TOKEN` in the `seed-token` HTTP header.
    """
    expected = os.getenv("SEED_TOKEN", "seed-secret")
    if seed_token != expected:
        raise forbidden("Invalid seed token")
    # Use centralised seeder; returns 'seeded' or 'already-seeded'
    result = seeder.seed_database(db)
    return {"message": result}