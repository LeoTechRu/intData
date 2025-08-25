"""Service layer for time tracking operations."""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import TimeEntry
from core.utils import utcnow


class TimeService:
    """CRUD helpers for the :class:`TimeEntry` model."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "TimeService":
        if self.session is None:
            self.session = db.async_session()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:  # pragma: no cover
        if not self._external:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
            await self.session.close()

    async def start_timer(
        self, owner_id: int, description: str | None = None
    ) -> TimeEntry:
        """Start a new timer for the given owner."""

        entry = TimeEntry(owner_id=owner_id, description=description)
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def stop_timer(self, entry_id: int) -> TimeEntry | None:
        """Stop timer by setting end time to now."""

        entry = await self.session.get(TimeEntry, entry_id)
        if entry is None:
            return None
        entry.end_time = utcnow()
        await self.session.flush()
        return entry

    async def list_entries(
        self, owner_id: Optional[int] = None
    ) -> List[TimeEntry]:
        """Return time entries, optionally filtered by owner."""

        stmt = select(TimeEntry)
        if owner_id is not None:
            stmt = stmt.where(TimeEntry.owner_id == owner_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
