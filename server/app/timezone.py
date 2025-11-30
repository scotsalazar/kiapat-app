from __future__ import annotations

from datetime import datetime, timedelta, timezone

PH_TIMEZONE = timezone(timedelta(hours=8))


def now_ph() -> datetime:
    """Return the current datetime in GMT+8 (Philippines)."""
    return datetime.now(PH_TIMEZONE)


def now_ph_naive() -> datetime:
    """Return a naive datetime aligned to GMT+8 for database compatibility."""
    return now_ph().replace(tzinfo=None)
