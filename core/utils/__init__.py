from datetime import datetime, UTC


def utcnow() -> datetime:
    """Return current naive time in UTC."""
    return datetime.now(UTC).replace(tzinfo=None)


__all__ = ["utcnow"]

