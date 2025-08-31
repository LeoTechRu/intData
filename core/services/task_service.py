"""Service layer for task operations."""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import (
    Task,
    TaskStatus,
    TaskCheckpoint,
    ScheduleException,
    Project,
    Area,
)
from core.services.time_service import TimeService
from sqlalchemy import func


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
        *,
        project_id: int | None = None,
        area_id: int | None = None,
        estimate_minutes: int | None = None,
    ) -> Task:
        """Create a new task for the given owner."""

        # Validate project/area ownership and consistency
        if project_id is not None:
            prj = await self.session.get(Project, project_id)
            if not prj or prj.owner_id != owner_id:
                raise PermissionError("Project belongs to different owner or not found")
            area_id = prj.area_id  # enforce inheritance
        elif area_id is not None:
            area = await self.session.get(Area, area_id)
            if not area or area.owner_id != owner_id:
                raise PermissionError("Area belongs to different owner or not found")

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
            project_id=project_id,
            area_id=area_id,
            estimate_minutes=estimate_minutes,
        )
        if cognitive_cost:
            task.neural_priority = 1 / cognitive_cost
        self.session.add(task)
        await self.session.flush()
        return task

    async def list_tasks(
        self,
        owner_id: Optional[int] = None,
        *,
        project_id: int | None = None,
        area_id: int | None = None,
    ) -> List[Task]:
        """Return tasks, optionally filtered by owner/area/project."""

        stmt = select(Task)
        if owner_id is not None:
            stmt = stmt.where(Task.owner_id == owner_id)
        if project_id is not None:
            stmt = stmt.where(Task.project_id == project_id)
        if area_id is not None:
            stmt = stmt.where(Task.area_id == area_id)
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

        # Enforce area inheritance from project if project changed
        if "project_id" in fields and task.project_id is not None:
            prj = await self.session.get(Project, task.project_id)
            if prj:
                task.area_id = prj.area_id

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

    # --- Time tracking helpers -------------------------------------------------
    async def start_timer(
        self, task_id: int, description: str | None = None
    ) -> Task | None:
        """Start a running timer linked to ``task_id``.

        Returns the task if successful, ``None`` if task not found.
        """
        task = await self.session.get(Task, task_id)
        if task is None:
            return None
        time_service = TimeService(self.session)
        await time_service.start_timer(
            owner_id=task.owner_id, description=description, task_id=task_id
        )
        return task

    async def total_tracked_minutes(self, task_id: int) -> int:
        """Return total tracked minutes for finished entries of a task.

        Uses Python aggregation for cross‑DB compatibility (SQLite, Postgres).
        """
        svc = TimeService(self.session)
        entries = await svc.list_entries_by_task(task_id)
        total = 0
        for e in entries:
            if e.end_time and e.start_time:
                total += int((e.end_time - e.start_time).total_seconds())
        return total // 60

    async def list_tasks_by_area(self, owner_id: int, area_id: int, include_sub: bool = False) -> List[Task]:
        if not include_sub:
            return await self.list_tasks(owner_id=owner_id, area_id=area_id)
        node = await self.session.get(Area, area_id)
        if not node:
            return []
        from sqlalchemy import and_, or_
        prefix = node.mp_path
        stmt = (
            select(Task)
            .join(Area, Area.id == Task.area_id)
            .where(and_(Task.owner_id == owner_id, or_(Area.mp_path == prefix, Area.mp_path.like(prefix + '%'))))
        )
        res = await self.session.execute(stmt)
        return res.scalars().all()
