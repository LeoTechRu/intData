"""Service layer for task operations."""

from __future__ import annotations

from typing import List, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import (
    Task,
    TaskStatus,
    TaskControlStatus,
    TaskRefuseReason,
    TaskReminder,
    TaskWatcher,
    TaskWatcherState,
    TaskWatcherLeftReason,
    TaskCheckpoint,
    ScheduleException,
    Project,
    Area,
)
from core.services.time_service import TimeService
from sqlalchemy import func
from core.utils import utcnow


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
        remind_policy: dict | None = None,
        control_enabled: bool = False,
        control_frequency: int | None = None,
        control_status: TaskControlStatus | None = None,
        control_next_at=None,
        refused_reason: TaskRefuseReason | None = None,
        is_watched: bool | None = None,
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
        else:
            raise ValueError("Task requires project_id or area_id")

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
            remind_policy=remind_policy or {},
            control_enabled=control_enabled,
            control_frequency=control_frequency,
            control_status=control_status or TaskControlStatus.active,
            control_next_at=control_next_at,
            refused_reason=refused_reason,
            is_watched=is_watched if is_watched is not None else False,
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

    async def set_control_settings(
        self,
        task_id: int,
        *,
        enabled: bool,
        frequency_minutes: int | None,
        next_at,
        remind_policy: dict | None = None,
        status: TaskControlStatus | None = None,
        refused_reason: TaskRefuseReason | None = None,
    ) -> Task | None:
        """Adjust control loop configuration for a task."""

        task = await self.session.get(Task, task_id)
        if task is None:
            return None
        task.control_enabled = enabled
        task.control_frequency = frequency_minutes
        task.control_next_at = next_at
        task.remind_policy = remind_policy or {}
        if enabled:
            task.control_status = status or TaskControlStatus.active
            task.refused_reason = None
        else:
            task.control_status = status or TaskControlStatus.dropped
            task.refused_reason = refused_reason
        await self.session.flush()
        return task

    async def schedule_reminder(
        self,
        task_id: int,
        owner_id: int,
        *,
        trigger_at,
        kind: str = "custom",
        frequency_minutes: int | None = None,
        payload: dict | None = None,
        is_active: bool = True,
    ) -> TaskReminder:
        """Persist reminder configuration for the task owner."""

        task = await self.session.get(Task, task_id)
        if task is None or task.owner_id != owner_id:
            raise PermissionError("Task not found or belongs to different owner")
        reminder = TaskReminder(
            task_id=task_id,
            owner_id=owner_id,
            kind=kind,
            trigger_at=trigger_at,
            frequency_minutes=frequency_minutes,
            payload=payload or {},
            is_active=is_active,
        )
        self.session.add(reminder)
        await self.session.flush()
        return reminder

    async def deactivate_reminders(
        self, task_id: int, *, kind: str | None = None
    ) -> int:
        """Mark reminders inactive and return affected count."""

        stmt = select(TaskReminder).where(TaskReminder.task_id == task_id)
        if kind:
            stmt = stmt.where(TaskReminder.kind == kind)
        res = await self.session.execute(stmt)
        reminders: Sequence[TaskReminder] = res.scalars().all()
        for reminder in reminders:
            reminder.is_active = False
            reminder.updated_at = utcnow()
        if reminders:
            await self.session.flush()
        return len(reminders)

    async def list_reminders(
        self, task_id: int, *, only_active: bool = True
    ) -> List[TaskReminder]:
        stmt = select(TaskReminder).where(TaskReminder.task_id == task_id)
        if only_active:
            stmt = stmt.where(TaskReminder.is_active.is_(True))
        res = await self.session.execute(stmt)
        return res.scalars().all()

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

    async def add_watcher(
        self,
        task_id: int,
        watcher_id: int,
        *,
        added_by: int | None = None,
    ) -> TaskWatcher:
        """Subscribe watcher to task updates (idempotent)."""

        task = await self.session.get(Task, task_id)
        if task is None:
            raise ValueError("Task not found")
        stmt = select(TaskWatcher).where(
            TaskWatcher.task_id == task_id,
            TaskWatcher.watcher_id == watcher_id,
            TaskWatcher.state == TaskWatcherState.active,
        )
        res = await self.session.execute(stmt)
        existing = res.scalars().first()
        if existing:
            return existing
        watcher = TaskWatcher(
            task_id=task_id,
            watcher_id=watcher_id,
            added_by=added_by,
            state=TaskWatcherState.active,
        )
        self.session.add(watcher)
        task.is_watched = True
        await self.session.flush()
        return watcher

    async def leave_watcher(
        self,
        task_id: int,
        watcher_id: int,
        *,
        reason: TaskWatcherLeftReason | None = None,
    ) -> bool:
        """Mark watcher as left; returns True if updated."""

        stmt = (
            select(TaskWatcher)
            .where(TaskWatcher.task_id == task_id)
            .where(TaskWatcher.watcher_id == watcher_id)
            .order_by(TaskWatcher.created_at.desc())
        )
        res = await self.session.execute(stmt)
        watcher = res.scalars().first()
        if watcher is None or watcher.state == TaskWatcherState.left:
            return False
        watcher.state = TaskWatcherState.left
        watcher.left_reason = reason
        watcher.left_at = utcnow()
        watcher.updated_at = utcnow()
        await self.session.flush()
        await self._sync_watch_flag(task_id)
        return True

    async def list_watchers(
        self, task_id: int, *, only_active: bool = True
    ) -> List[TaskWatcher]:
        stmt = select(TaskWatcher).where(TaskWatcher.task_id == task_id)
        if only_active:
            stmt = stmt.where(TaskWatcher.state == TaskWatcherState.active)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def _sync_watch_flag(self, task_id: int) -> None:
        stmt = (
            select(func.count())
            .select_from(TaskWatcher)
            .where(TaskWatcher.task_id == task_id)
            .where(TaskWatcher.state == TaskWatcherState.active)
        )
        res = await self.session.execute(stmt)
        count = res.scalar_one()
        task = await self.session.get(Task, task_id)
        if task is not None:
            task.is_watched = bool(count)
            await self.session.flush()

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

    async def stats_by_owner(self, owner_id: int) -> dict[str, int]:
        """Return counts of done, active and dropped tasks for owner."""

        stmt = select(Task.status, Task.control_status).where(Task.owner_id == owner_id)
        res = await self.session.execute(stmt)
        done = active = dropped = 0
        for status, control_status in res:
            if status == TaskStatus.done:
                done += 1
            elif control_status == TaskControlStatus.dropped and status != TaskStatus.done:
                dropped += 1
            else:
                active += 1
        return {"done": done, "active": active, "dropped": dropped}
