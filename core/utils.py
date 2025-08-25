from datetime import datetime, UTC


def utcnow() -> datetime:
    """Return current time in UTC."""
    return datetime.now(UTC)

