"""PARA service: CRUD and operations for Areas, Projects, Resources,
and helpers to move/assign notes and archive entities.

Minimal, non-breaking skeleton that reuses existing models and sessions.
"""

from __future__ import annotations

from typing import Optional, Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend import db
from backend.models import (
    Area,
    Project,
    Resource,
    Note,
    ContainerType,
)
from .area_service import AreaService


class ParaService:
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "ParaService":
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

    # --- CRUD: Areas ---------------------------------------------------------
    async def create_area(
        self,
        owner_id: int,
        name: str,
        *,
        title: str | None = None,
        color: str | None = None,
        review_interval_days: int = 7,
    ) -> Area:
        area = Area(
            owner_id=owner_id,
            name=name,
            title=title or name,
            color=color,
            review_interval_days=review_interval_days,
            is_active=True,
        )
        self.session.add(area)
        await self.session.flush()
        return area

    async def list_areas(self, owner_id: Optional[int] = None) -> Iterable[Area]:
        stmt = select(Area)
        if owner_id is not None:
            stmt = stmt.where(Area.owner_id == owner_id)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    # --- CRUD: Projects ------------------------------------------------------
    async def create_project(
        self,
        owner_id: int,
        name: str,
        *,
        area_id: int,
        slug: str | None = None,
        description: str | None = None,
    ) -> Project:
        # Ensure project belongs to an area of the same owner
        area = await self.session.get(Area, area_id)
        if not area or area.owner_id != owner_id:
            raise PermissionError("Area belongs to different owner or not found")
        if not await AreaService(self.session).is_leaf(area_id):
            raise ValueError("Project must be linked to a leaf Area")
        project = Project(
            owner_id=owner_id,
            area_id=area_id,
            name=name,
            description=description,
            slug=slug,
        )
        self.session.add(project)
        await self.session.flush()
        return project

    async def list_projects(self, owner_id: Optional[int] = None) -> Iterable[Project]:
        stmt = select(Project)
        if owner_id is not None:
            stmt = stmt.where(Project.owner_id == owner_id)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    
    async def list_projects_by_area(self, owner_id: int, area_id: int, include_sub: bool = False):
        if not include_sub:
            stmt = select(Project).where(Project.owner_id == owner_id, Project.area_id == area_id)
            res = await self.session.execute(stmt)
            return res.scalars().all()
        node = await self.session.get(Area, area_id)
        if not node:
            return []
        prefix = node.mp_path
        from sqlalchemy import and_, or_
        stmt = (
            select(Project)
            .join(Area, Area.id == Project.area_id)
            .where(and_(Project.owner_id == owner_id, or_(Area.mp_path == prefix, Area.mp_path.like(prefix + '%'))))
        )
        res = await self.session.execute(stmt)
        return res.scalars().all()

# --- CRUD: Resources -----------------------------------------------------
    async def create_resource(
        self, owner_id: int, title: str, *, content: str | None = None, type: str | None = None
    ) -> Resource:
        r = Resource(owner_id=owner_id, title=title, content=content, type=type)
        self.session.add(r)
        await self.session.flush()
        return r

    async def list_resources(self, owner_id: Optional[int] = None) -> Iterable[Resource]:
        stmt = select(Resource)
        if owner_id is not None:
            stmt = stmt.where(Resource.owner_id == owner_id)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    # --- Note assignment / move ---------------------------------------------
    async def assign_note_container(
        self,
        note_id: int,
        *,
        owner_id: int,
        container_type: ContainerType,
        container_id: int,
    ) -> Note:
        note = await self.session.get(Note, note_id)
        if not note or note.owner_id != owner_id:
            raise PermissionError("Note not found or belongs to different owner")

        # Validate container owner
        if container_type is ContainerType.project:
            obj = await self.session.get(Project, container_id)
        elif container_type is ContainerType.area:
            obj = await self.session.get(Area, container_id)
        else:
            obj = await self.session.get(Resource, container_id)
        if not obj or getattr(obj, "owner_id", None) != owner_id:
            raise PermissionError("Container belongs to different owner or not found")

        note.container_type = container_type
        note.container_id = container_id
        await self.session.flush()
        return note

    async def archive(self, obj) -> None:
        """Soft-archive entity by setting archived_at."""
        from backend.utils import utcnow

        if hasattr(obj, "archived_at"):
            obj.archived_at = utcnow()
            await self.session.flush()

    async def unarchive(self, obj) -> None:
        if hasattr(obj, "archived_at"):
            obj.archived_at = None
            await self.session.flush()

