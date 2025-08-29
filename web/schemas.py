from __future__ import annotations

from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, validator


class ProfileUpdate(BaseModel):
    """Schema for validating profile updates."""

    full_display_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    birthday: Optional[date] = None
    language_code: Optional[str] = None

    @validator("birthday", pre=True)
    def parse_birthday(cls, value: str | None) -> Optional[date]:  # noqa: D401 - simple validator
        """Parse birthday in either YYYY-MM-DD or DD.MM.YYYY formats."""
        if not value:
            return None
        for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        raise ValueError("Invalid date format")

    class Config:
        extra = "ignore"
