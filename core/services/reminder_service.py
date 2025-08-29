"""Service layer for reminder operations."""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import Reminder


class ReminderService:
    """CRUD helpers for the :class:`Reminder` model."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "ReminderService":
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

    async def create_reminder(
        self,
        owner_id: int,
        message: str,
        remind_at,
        task_id: int | None = None,
    ) -> Reminder:
        """Create a new reminder for the given owner."""

        reminder = Reminder(
            owner_id=owner_id,
            message=message,
            remind_at=remind_at,
            task_id=task_id,
        )
        self.session.add(reminder)
        await self.session.flush()
        return reminder

    async def list_reminders(
        self, owner_id: Optional[int] = None, task_id: Optional[int] = None
    ) -> List[Reminder]:
        """Return reminders, optionally filtered by owner or task."""

        stmt = select(Reminder)
        if owner_id is not None:
            stmt = stmt.where(Reminder.owner_id == owner_id)
        if task_id is not None:
            stmt = stmt.where(Reminder.task_id == task_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def update_reminder(self, reminder_id: int, **fields) -> Reminder | None:
        """Update reminder fields and return the reminder."""

        reminder = await self.session.get(Reminder, reminder_id)
        if reminder is None:
            return None
        for key, value in fields.items():
            if not hasattr(reminder, key) or value is None:
                continue
            setattr(reminder, key, value)
        await self.session.flush()
        return reminder

    async def delete_reminder(self, reminder_id: int) -> bool:
        """Delete reminder by id."""

        reminder = await self.session.get(Reminder, reminder_id)
        if reminder is None:
            return False
        await self.session.delete(reminder)
        await self.session.flush()
        return True

    async def mark_done(self, reminder_id: int) -> Reminder | None:
        """Mark reminder as done."""

        reminder = await self.session.get(Reminder, reminder_id)
        if reminder is None:
            return None
        reminder.is_done = True
        await self.session.flush()
        return reminder
