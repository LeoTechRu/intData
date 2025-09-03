"""Service layer for time tracking operations."""

from __future__ import annotations

from typing import List, Optional
from collections import defaultdict


from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import TimeEntry, Task, TaskStatus
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

    async def _ensure_inbox(self, owner_id: int):
        """Return owner's default 'Inbox' area, creating if missing."""
        from core.models import Area
        stmt = select(Area).where(
            Area.owner_id == owner_id,
            or_(Area.slug == "inbox", Area.name.ilike("входящие")),
        )
        res = await self.session.execute(stmt)
        inbox = res.scalar_one_or_none()
        if inbox is None:
            inbox = Area(owner_id=owner_id, name="Входящие", title="Входящие")
            inbox.slug = "inbox"
            self.session.add(inbox)
            await self.session.flush()
        return inbox

    async def start_timer(
        self,
        owner_id: int,
        description: str | None = None,
        *,
        task_id: int | None = None,
        exclusive: bool = True,
        create_task_if_missing: bool = True,
        project_id: int | None = None,
        area_id: int | None = None,
    ) -> TimeEntry:
        """Start a new timer for the given owner.

        - If ``task_id`` is provided, links the entry to the task and
          (soft) enforces that the task belongs to the same owner.
        - If ``exclusive`` is True, refuses to start when another timer
          without ``end_time`` exists for the owner.
        """

        if exclusive:
            stmt = (
                select(TimeEntry)
                .where(TimeEntry.owner_id == owner_id)
                .where(TimeEntry.end_time.is_(None))
                .order_by(TimeEntry.start_time.desc())
            )
            res = await self.session.execute(stmt)
            running = res.scalars().first()
            if running:
                raise ValueError(
                    f"Another timer #{running.id} is already running for owner {owner_id}."
                )

        linked_task: Task | None = None
        if task_id is not None:
            linked_task = await self.session.get(Task, task_id)
            if linked_task is None:
                raise ValueError("Task not found")
            if linked_task.owner_id != owner_id:
                raise PermissionError("Task belongs to different owner")
        elif create_task_if_missing:
            if project_id is not None:
                from core.models import Project
                prj = await self.session.get(Project, project_id)
                if not prj or prj.owner_id != owner_id:
                    raise PermissionError("Project belongs to different owner or not found")
                area_id = prj.area_id
            elif area_id is not None:
                from .area_service import AreaService
                if not await AreaService(self.session).is_leaf(area_id):
                    raise ValueError("Area must be a leaf")
            else:
                inbox = await self._ensure_inbox(owner_id)
                area_id = inbox.id
            # Auto-create a task when none supplied
            title = description or "Новая задача"
            linked_task = Task(
                owner_id=owner_id,
                title=title,
                status=TaskStatus.in_progress,
                project_id=project_id,
                area_id=area_id,
            )
            self.session.add(linked_task)
            await self.session.flush()  # get task.id
            task_id = linked_task.id

        # accept direct project/area assignment when no task provided
        if linked_task is None:
            if project_id is not None:
                from core.models import Project
                prj = await self.session.get(Project, project_id)
                if not prj or prj.owner_id != owner_id:
                    raise PermissionError("Project belongs to different owner or not found")
                area_id = prj.area_id
            if area_id is not None:
                from .area_service import AreaService
                if not await AreaService(self.session).is_leaf(area_id):
                    raise ValueError("Area must be a leaf")

        entry = TimeEntry(owner_id=owner_id, description=description, task_id=task_id)
        # Inherit PARA lineage
        if linked_task is not None:
            entry.project_id = getattr(linked_task, "project_id", None)
            entry.area_id = getattr(linked_task, "area_id", None)
        else:
            entry.project_id = project_id
            entry.area_id = area_id
        self.session.add(entry)
        # optional: set task status in_progress when starting timer
        if linked_task and linked_task.status != TaskStatus.done:
            linked_task.status = TaskStatus.in_progress
        await self.session.flush()
        return entry

    async def resume_task(self, owner_id: int, task_id: int, description: str | None = None) -> TimeEntry:
        """Resume work on an existing task by creating a new running entry.

        Enforces single active timer per owner; validates ownership.
        """
        return await self.start_timer(
            owner_id=owner_id,
            description=description,
            task_id=task_id,
            exclusive=True,
            create_task_if_missing=False,
        )

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

    async def list_entries_by_task(self, task_id: int) -> List[TimeEntry]:
        """Return time entries linked to the given task."""
        stmt = select(TimeEntry).where(TimeEntry.task_id == task_id)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def assign_task(self, entry_id: int, task_id: int, *, owner_id: int) -> TimeEntry:
        """Attach an existing entry to a task and inherit project/area."""
        entry = await self.session.get(TimeEntry, entry_id)
        if not entry or entry.owner_id != owner_id:
            raise PermissionError("Entry not found or belongs to different owner")
        task = await self.session.get(Task, task_id)
        if not task or task.owner_id != owner_id:
            raise PermissionError("Task not found or belongs to different owner")
        entry.task_id = task.id
        entry.project_id = getattr(task, "project_id", None)
        entry.area_id = getattr(task, "area_id", None)
        await self.session.flush()
        return entry

    async def get_running_entry(self, owner_id: int, task_id: int | None = None) -> TimeEntry | None:
        """Return latest running (no end_time) entry for owner, optionally for a specific task."""
        stmt = (
            select(TimeEntry)
            .where(TimeEntry.owner_id == owner_id)
            .where(TimeEntry.end_time.is_(None))
            .order_by(TimeEntry.start_time.desc())
        )
        if task_id is not None:
            stmt = stmt.where(TimeEntry.task_id == task_id)
        res = await self.session.execute(stmt)
        return res.scalars().first()


    async def list_entries_filtered(self, owner_id: int, *, area_id: int | None = None, include_sub: bool = False, time_from=None, time_to=None) -> list[TimeEntry]:
        stmt = select(TimeEntry).where(TimeEntry.owner_id == owner_id)
        from sqlalchemy import and_, or_
        if area_id is not None:
            if include_sub:
                from core.models import Area
                node = await self.session.get(Area, area_id)
                if node:
                    prefix = node.mp_path
                    stmt = stmt.join(Area, Area.id == TimeEntry.area_id).where(or_(Area.mp_path == prefix, Area.mp_path.like(prefix + '%')))
            else:
                stmt = stmt.where(TimeEntry.area_id == area_id)
        if time_from is not None:
            stmt = stmt.where(TimeEntry.start_time >= time_from)
        if time_to is not None:
            stmt = stmt.where(TimeEntry.start_time <= time_to)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def summary(self, *, owner_id: int | None = None, group_by: str = "day") -> list[dict]:
        """Aggregate durations grouped by the specified field.

        Durations are returned in seconds. ``group_by`` supports
        ``day``, ``project``, ``area`` and ``user``.
        """

        if group_by not in {"day", "project", "area", "user"}:
            raise ValueError("invalid group_by")
        stmt = select(TimeEntry)
        if owner_id is not None:
            stmt = stmt.where(TimeEntry.owner_id == owner_id)
        res = await self.session.execute(stmt)
        entries = res.scalars().all()
        totals: dict[str, int] = defaultdict(int)
        for e in entries:
            if not e.start_time or not e.end_time:
                continue
            dur = e.duration_seconds or 0
            if group_by == "day":
                key = e.start_time.date().isoformat()
            elif group_by == "project":
                key = str(e.project_id)
            elif group_by == "area":
                key = str(e.area_id)
            else:
                key = str(e.owner_id)
            totals[key] += dur
        result = []
        for key, total in totals.items():
            if group_by == "day":
                result.append({"day": key, "total_seconds": total})
            elif group_by == "project":
                result.append({"project_id": None if key == "None" else int(key), "total_seconds": total})
            elif group_by == "area":
                result.append({"area_id": None if key == "None" else int(key), "total_seconds": total})
            else:
                result.append({"owner_id": int(key), "total_seconds": total})
        return result
