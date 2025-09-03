"""Helpers for working with time values in tests."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


UTC = timezone.utc


def iso(dt: datetime) -> str:
    """Return ISO-8601 string (UTC) without microseconds."""
    return dt.astimezone(UTC).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def add_days(dt: datetime, days: int) -> datetime:
    return dt + timedelta(days=days)


def rrule_daily(interval: int = 1) -> str:
    return f"FREQ=DAILY;INTERVAL={interval}"

