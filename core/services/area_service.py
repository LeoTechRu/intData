"""AreaService: nested Areas via materialized path.

Provides helpers to create/move/inspect/list subtrees.
"""
from __future__ import annotations

from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import Area
from core.services.profile_service import ProfileService


def _slugify(name: str) -> str:
    import re
    s = (name or '').lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return s or 'area'


class AreaService:
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "AreaService":
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

    async def _unique_slug(self, owner_id: int, base: str) -> str:
        slug = base
        n = 2
        # naive uniqueness loop
        while True:
            stmt = select(Area).where(Area.owner_id == owner_id, Area.slug == slug)
            res = await self.session.execute(stmt)
            if res.scalars().first() is None:
                return slug
            slug = f"{base}-{n}"
            n += 1

    async def get(self, area_id: int) -> Area | None:
        return await self.session.get(Area, area_id)

    async def create_area(self, owner_id: int, name: str, parent_id: int | None = None, *, color: str | None = None) -> Area:
        parent = None
        depth = 0
        if parent_id is not None:
            parent = await self.session.get(Area, parent_id)
            if not parent or parent.owner_id != owner_id:
                raise PermissionError("Parent area not found or belongs to different owner")
            depth = int(getattr(parent, 'depth', 0)) + 1

        base = _slugify(name)
        slug = await self._unique_slug(owner_id, base)
        mp_prefix = parent.mp_path if parent else ''
        mp_path = f"{mp_prefix}{slug}."
        a = Area(
            owner_id=owner_id,
            name=name,
            title=name,
            parent_id=parent_id,
            slug=slug,
            mp_path=mp_path,
            depth=depth,
            is_active=True,
            color=color or "#F1F5F9",
        )
        self.session.add(a)
        await self.session.flush()
        async with ProfileService(self.session) as profiles:
            await profiles.upsert_profile_meta(
                entity_type="area",
                entity_id=a.id,
                updates={
                    "slug": a.slug or f"area-{a.id}",
                    "display_name": a.title or a.name,
                    "profile_meta": {
                        "color": a.color,
                        "depth": int(a.depth or 0),
                    },
                    "sections": [
                        {"id": "overview", "title": "Область"},
                        {"id": "initiatives", "title": "Инициативы"},
                        {"id": "contacts", "title": "Контакты"},
                    ],
                },
            )
        return a

    async def move_area(self, area_id: int, new_parent_id: int | None) -> Area:
        area = await self.session.get(Area, area_id)
        if not area:
            raise ValueError("Area not found")
        if new_parent_id == area.parent_id:
            return area
        new_parent = None
        new_depth = 0
        if new_parent_id is not None:
            new_parent = await self.session.get(Area, new_parent_id)
            if not new_parent or new_parent.owner_id != area.owner_id:
                raise PermissionError("Target parent invalid")
            # prevent cycle: parent cannot be inside subtree of area
            if getattr(new_parent, 'mp_path', '').startswith(getattr(area, 'mp_path', '')):
                raise ValueError("Cannot move under its own subtree")
            new_depth = int(getattr(new_parent, 'depth', 0)) + 1
        old_prefix = area.mp_path
        new_prefix = (new_parent.mp_path if new_parent else '') + area.slug + '.'
        depth_delta = new_depth - int(area.depth)

        # fetch subtree
        stmt = select(Area).where((Area.mp_path == old_prefix) | (Area.mp_path.like(old_prefix + '%')))
        res = await self.session.execute(stmt)
        nodes: list[Area] = res.scalars().all()
        for node in nodes:
            suffix = node.mp_path[len(old_prefix):]
            node.mp_path = new_prefix + suffix
            node.depth = int(node.depth) + depth_delta
        area.parent_id = new_parent_id
        await self.session.flush()
        return area

    async def is_leaf(self, area_id: int) -> bool:
        stmt = select(Area).where(Area.parent_id == area_id)
        res = await self.session.execute(stmt)
        return res.scalars().first() is None

    async def list_subtree(self, area_id: int) -> Iterable[Area]:
        node = await self.session.get(Area, area_id)
        if not node:
            return []
        prefix = node.mp_path
        stmt = select(Area).where((Area.mp_path == prefix) | (Area.mp_path.like(prefix + '%')))
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def mp_path(self, area_id: int) -> str:
        node = await self.session.get(Area, area_id)
        return node.mp_path if node else ''
