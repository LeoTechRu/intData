from datetime import UTC, datetime


def utcnow() -> datetime:
    """Return current naive time in UTC."""
    return datetime.now(UTC).replace(tzinfo=None)


def utcnow_aware() -> datetime:
    """Return current timezone-aware UTC datetime."""
    return datetime.now(UTC)


__all__ = ["utcnow", "utcnow_aware"]
