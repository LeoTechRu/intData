"""Service layer for alarm operations."""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import Alarm, CalendarItem, Area, NotificationTrigger
from core.utils import utcnow


class AlarmService:
    """CRUD helpers for the :class:`Alarm` model."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "AlarmService":
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

    async def list_upcoming(
        self, owner_id: int, limit: int | None = None
    ) -> List[Alarm]:
        """Return upcoming alarms for the given owner."""

        now = utcnow()
        stmt = (
            select(Alarm)
            .join(CalendarItem, Alarm.item_id == CalendarItem.id)
            .join(Area, CalendarItem.area_id == Area.id)
            .where(Area.owner_id == owner_id)
            .where(Alarm.trigger_at >= now)
            .order_by(Alarm.trigger_at)
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def list_for_item(
        self, owner_id: int, item_id: int
    ) -> List[Alarm]:
        """Return alarms for a specific calendar item owned by user."""

        stmt = (
            select(Alarm)
            .join(CalendarItem, Alarm.item_id == CalendarItem.id)
            .join(Area, CalendarItem.area_id == Area.id)
            .where(Area.owner_id == owner_id)
            .where(Alarm.item_id == item_id)
            .order_by(Alarm.trigger_at)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def create_alarm(self, item_id: int, trigger_at) -> Alarm:
        """Create an alarm and schedule notification trigger."""

        alarm = Alarm(item_id=item_id, trigger_at=trigger_at)
        self.session.add(alarm)
        await self.session.flush()
        self.session.add(
            NotificationTrigger(
                next_fire_at=trigger_at,
                alarm_id=alarm.id,
                dedupe_key=f"alarm:{alarm.id}",
            )
        )
        await self.session.flush()
        return alarm
