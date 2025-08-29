"""Service layer for calendar event operations."""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import CalendarEvent


class CalendarService:
    """CRUD helpers for the :class:`CalendarEvent` model."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "CalendarService":
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

    async def create_event(
        self,
        owner_id: int,
        title: str,
        start_at,
        end_at=None,
        description: str | None = None,
    ) -> CalendarEvent:
        """Create a new calendar event for the given owner."""

        event = CalendarEvent(
            owner_id=owner_id,
            title=title,
            start_at=start_at,
            end_at=end_at,
            description=description,
        )
        self.session.add(event)
        await self.session.flush()
        return event

    async def list_events(self, owner_id: Optional[int] = None) -> List[CalendarEvent]:
        """Return events, optionally filtered by owner."""

        stmt = select(CalendarEvent)
        if owner_id is not None:
            stmt = stmt.where(CalendarEvent.owner_id == owner_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_event(
        self, event_id: int, owner_id: Optional[int] = None
    ) -> CalendarEvent | None:
        """Fetch a single event by ID, optionally scoped to ``owner_id``."""

        stmt = select(CalendarEvent).where(CalendarEvent.id == event_id)
        if owner_id is not None:
            stmt = stmt.where(CalendarEvent.owner_id == owner_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_event(
        self,
        event: CalendarEvent,
        *,
        title=None,
        start_at=None,
        end_at=None,
        description=None,
    ) -> CalendarEvent:
        """Update mutable fields of an event and flush changes."""

        if title is not None:
            event.title = title
        if start_at is not None:
            event.start_at = start_at
        if end_at is not None:
            event.end_at = end_at
        if description is not None:
            event.description = description
        self.session.add(event)
        await self.session.flush()
        return event

    async def delete_event(self, event: CalendarEvent) -> None:
        """Delete an event and flush session."""

        await self.session.delete(event)
        await self.session.flush()

    async def list_events_between(
        self,
        owner_id: int,
        start_at,
        end_at,
    ) -> List[CalendarEvent]:
        """Return events for ``owner_id`` within the [start_at, end_at] range."""

        stmt = (
            select(CalendarEvent)
            .where(CalendarEvent.owner_id == owner_id)
            .where(CalendarEvent.start_at >= start_at)
            .where(CalendarEvent.start_at <= end_at)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

