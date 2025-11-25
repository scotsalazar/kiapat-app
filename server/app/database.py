"""
Database configuration and session management for the Kiapat inventory
application.  This module encapsulates creation of the SQLAlchemy engine
and session factory as well as providing a generator function that can
be used in FastAPI dependency injection.

The database URL is loaded from an environment variable (DATABASE_URL)
with a sensible default of an SQLite database located in the project
directory.  SQLite is used for local development and testing, however
PostgreSQL is fully supported by simply changing the connection string.

All timestamps are stored in UTC.  See README for instructions on
migrating to Postgres.
"""

from __future__ import annotations

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Read the database URL from the environment, falling back to SQLite
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./data/kiapat.db"
)

# When using SQLite, the "check_same_thread" flag must be set to False to
# allow the connection to be shared across threads.  For Postgres this
# option is ignored.
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# Create the SQLAlchemy engine and session factory
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a database session.

    Each request will get its own session which is closed after the
    request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()