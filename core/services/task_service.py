"""Service layer for task operations."""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import (
    Task,
    TaskStatus,
    Reminder,
    TaskCheckpoint,
    ScheduleException,
)
from core.services.reminder_service import ReminderService


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
        status: TaskStatus = TaskStatus.todo,
        cognitive_cost: int | None = None,
        repeat_config: dict | None = None,
        recurrence: str | None = None,
        excluded_dates: list | None = None,
        custom_properties: dict | None = None,
        schedule_type: str | None = None,
    ) -> Task:
        """Create a new task for the given owner."""

        task = Task(
            owner_id=owner_id,
            title=title,
            description=description,
            due_date=due_date,
            status=status,
            cognitive_cost=cognitive_cost,
            repeat_config=repeat_config or {},
            recurrence=recurrence,
            excluded_dates=excluded_dates or [],
            custom_properties=custom_properties or {},
            schedule_type=schedule_type,
        )
        if cognitive_cost:
            task.neural_priority = 1 / cognitive_cost
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

    async def update_task(self, task_id: int, **fields) -> Task | None:
        """Update task fields and return the task."""

        task = await self.session.get(Task, task_id)
        if task is None:
            return None

        for key, value in fields.items():
            if not hasattr(task, key) or value is None:
                continue
            setattr(task, key, value)
            if key == "cognitive_cost" and value:
                task.neural_priority = 1 / value

        await self.session.flush()
        return task

    async def delete_task(self, task_id: int) -> bool:
        """Delete a task by id."""

        task = await self.session.get(Task, task_id)
        if task is None:
            return False
        await self.session.delete(task)
        await self.session.flush()
        return True

    async def mark_done(self, task_id: int) -> Task | None:
        """Mark task as done."""

        task = await self.session.get(Task, task_id)
        if task is None:
            return None
        task.status = TaskStatus.done
        await self.session.flush()
        return task

    async def add_reminder(
        self, task_id: int, message: str, remind_at
    ) -> Reminder | None:
        """Attach a reminder to the specified task."""

        task = await self.session.get(Task, task_id)
        if task is None:
            return None
        reminder_service = ReminderService(self.session)
        return await reminder_service.create_reminder(
            owner_id=task.owner_id,
            message=message,
            remind_at=remind_at,
            task_id=task.id,
        )

    async def add_checkpoint(
        self, task_id: int, name: str, completed: bool = False
    ) -> TaskCheckpoint | None:
        task = await self.session.get(Task, task_id)
        if task is None:
            return None
        checkpoint = TaskCheckpoint(
            task_id=task_id, name=name, completed=completed
        )
        self.session.add(checkpoint)
        await self.session.flush()
        return checkpoint

    async def add_schedule_exception(
        self, task_id: int, date, reason: str | None = None
    ) -> ScheduleException | None:
        task = await self.session.get(Task, task_id)
        if task is None:
            return None
        exc = ScheduleException(task_id=task_id, date=date, reason=reason)
        self.session.add(exc)
        await self.session.flush()
        return exc
