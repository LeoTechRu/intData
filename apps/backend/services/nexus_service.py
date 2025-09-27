"""Generic CRUD services for extended models."""
from __future__ import annotations

from typing import Generic, TypeVar, Type, Optional, List

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend import db
from backend.models import (
    Area,
    Project,
    Habit,
    Resource,
    Archive,
    OKR,
    KeyResult,
    Interface,
    Limit,
    Role,
    AuthPermission,
    UserRoleLink,
    Link,
)
from datetime import date

from ..utils.habit_utils import generate_calendar
from .profile_service import ProfileService, normalize_slug

T = TypeVar("T", bound=db.Base)


class CRUDService(Generic[T]):
    """Minimal async CRUD helper."""

    def __init__(self, model: Type[T], session: Optional[AsyncSession] = None) -> None:
        self.model = model
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "CRUDService[T]":
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

    async def create(self, **kwargs) -> T:
        obj = self.model(**kwargs)
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def get(self, obj_id: int) -> T | None:
        return await self.session.get(self.model, obj_id)

    async def list(self, **filters) -> List[T]:
        stmt = select(self.model)
        for field, value in filters.items():
            stmt = stmt.where(getattr(self.model, field) == value)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def update(self, obj_id: int, **kwargs) -> T | None:
        obj = await self.get(obj_id)
        if obj is None:
            return None
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.session.flush()
        return obj

    async def delete(self, obj_id: int) -> bool:
        obj = await self.get(obj_id)
        if obj is None:
            return False
        await self.session.delete(obj)
        return True


class AreaService(CRUDService[Area]):
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(Area, session)


class ProjectService(CRUDService[Project]):
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(Project, session)


class HabitService(CRUDService[Habit]):
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(Habit, session)

    async def create_habit(
        self,
        owner_id: int,
        name: str,
        frequency: str = "daily",
        *,
        area_id: int | None = None,
        project_id: int | None = None,
    ) -> Habit:
        if frequency not in {"daily", "weekly", "monthly"}:
            raise ValueError("Invalid frequency")
        if project_id is not None:
            project = await self.session.get(Project, project_id)
            if project is None or project.owner_id != owner_id:
                raise PermissionError("Project not found or belongs to different owner")
            area_id = project.area_id
        if area_id is None:
            inbox = await self._ensure_inbox(owner_id)
            area_id = inbox.id
        return await self.create(
            owner_id=owner_id,
            title=name,
            frequency=frequency,
            area_id=area_id,
            project_id=project_id,
        )

    async def list_habits(self, owner_id: int) -> List[Habit]:
        stmt = (
            select(Habit)
            .where(Habit.owner_id == owner_id)
            .options(
                selectinload(Habit.area),
                selectinload(Habit.project),
            )
        )
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def toggle_progress(self, habit_id: int, day: date) -> Habit | None:
        habit = await self.get(habit_id)
        if habit is None:
            return None
        habit.toggle_progress(day)
        await self.session.flush()
        return habit

    async def get_calendar(self, habit_id: int):
        habit = await self.get(habit_id)
        if habit is None:
            return []
        return generate_calendar(habit, None)

    async def _ensure_inbox(self, owner_id: int) -> Area:
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


class ResourceService(CRUDService[Resource]):
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(Resource, session)

    async def create(self, **kwargs) -> Resource:
        resource = await super().create(**kwargs)
        await self._sync_profile(resource)
        return resource

    async def update(self, obj_id: int, **kwargs) -> Resource | None:
        resource = await super().update(obj_id, **kwargs)
        if resource:
            await self._sync_profile(resource)
        return resource

    async def _sync_profile(self, resource: Resource) -> None:
        updates = {
            "slug": normalize_slug(resource.title, f"resource-{resource.id}"),
            "display_name": resource.title,
            "summary": resource.content,
            "profile_meta": {"type": resource.type, "owner_id": resource.owner_id},
        }
        if resource.meta and isinstance(resource.meta, dict):
            tags = resource.meta.get("tags")
            if tags:
                updates["tags"] = tags
        async with ProfileService(self.session) as profiles:
            await profiles.upsert_profile_meta(
                entity_type="resource",
                entity_id=resource.id,
                updates=updates,
            )


class ArchiveService(CRUDService[Archive]):
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(Archive, session)


class OKRService(CRUDService[OKR]):
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(OKR, session)


class KeyResultService(CRUDService[KeyResult]):
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(KeyResult, session)


class InterfaceService(CRUDService[Interface]):
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(Interface, session)


class LimitService(CRUDService[Limit]):
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(Limit, session)


class RoleService(CRUDService[Role]):
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(Role, session)


class PermService(CRUDService[AuthPermission]):
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(AuthPermission, session)


class UserRoleService(CRUDService[UserRoleLink]):
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(UserRoleLink, session)


class LinkService(CRUDService[Link]):
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(Link, session)

    async def related(self, source_id: int, link_type: str | None = None):
        stmt = select(Link).where(Link.source_id == source_id)
        if link_type is not None:
            stmt = stmt.where(Link.link_type == link_type)
        result = await self.session.execute(stmt)
        return result.scalars().all()
