"""Service layer for task operations."""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import Task


class TaskService:
    """CRUD helpers for the :class:`Task` model."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "TaskService":
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

    async def create_task(
        self,
        owner_id: int,
        title: str,
        description: str | None = None,
        due_date=None,
    ) -> Task:
        """Create a new task for the given owner."""

        task = Task(
            owner_id=owner_id,
            title=title,
            description=description,
            due_date=due_date,
        )
        self.session.add(task)
        await self.session.flush()
        return task

    async def list_tasks(self, owner_id: Optional[int] = None) -> List[Task]:
        """Return tasks, optionally filtered by owner."""

        stmt = select(Task)
        if owner_id is not None:
            stmt = stmt.where(Task.owner_id == owner_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
