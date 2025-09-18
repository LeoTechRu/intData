"""Service layer for note operations."""

from __future__ import annotations

from typing import List, Optional
from datetime import datetime

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core import db
from core.models import Area, ContainerType, Link, LinkType, Note


class NoteService:
    """CRUD helpers for the :class:`Note` model."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "NoteService":
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

    async def create_note(
        self,
        owner_id: int,
        content: str,
        *,
        area_id: int,
        project_id: int | None = None,
        title: str | None = None,
        pinned: bool = False,
    ) -> Note:
        max_order_stmt = (
            select(func.max(Note.order_index))
            .where(
                Note.owner_id == owner_id,
                Note.area_id == area_id,
                Note.project_id == project_id,
            )
        )
        max_order = (await self.session.execute(max_order_stmt)).scalar() or 0
        if not title:
            title = content.strip().split("\n", 1)[0][:255]
        note = Note(
            owner_id=owner_id,
            title=title,
            content=content,
            area_id=area_id,
            project_id=project_id,
            pinned=pinned,
            order_index=max_order + 1,
        )
        self.session.add(note)
        await self.session.flush()
        return note

    async def _ensure_inbox(self, owner_id: int) -> Area:
        stmt = select(Area).where(
            Area.owner_id == owner_id,
            or_(Area.slug == "inbox", Area.name.ilike("входящие")),
        )
        res = await self.session.execute(stmt)
        inbox = res.scalars().first()
        if inbox is None:
            inbox = Area(owner_id=owner_id, name="Входящие", title="Входящие")
            inbox.slug = "inbox"
            inbox.mp_path = "inbox."
            inbox.depth = 0
            self.session.add(inbox)
            await self.session.flush()
        return inbox

    async def list_inbox(self, owner_id: int) -> List[Note]:
        inbox = await self._ensure_inbox(owner_id)
        stmt = (
            select(Note)
            .options(selectinload(Note.area), selectinload(Note.project))
            .where(Note.owner_id == owner_id)
            .where(Note.area_id == inbox.id)
            .where(Note.archived_at.is_(None))
            .order_by(Note.pinned.desc(), Note.order_index)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def list_notes(
        self,
        owner_id: int,
        *,
        area_id: int | None = None,
        include_sub: bool = False,
        project_id: int | None = None,
        pinned: bool | None = None,
        archived: bool | None = False,
        q: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> List[Note]:
        stmt = (
            select(Note)
            .options(selectinload(Note.area), selectinload(Note.project))
            .where(Note.owner_id == owner_id)
        )
        if area_id is not None:
            if include_sub:
                node = await self.session.get(Area, area_id)
                if node is None:
                    return []
                prefix = node.mp_path
                stmt = stmt.join(Area, Area.id == Note.area_id).where(
                    or_(Area.mp_path == prefix, Area.mp_path.like(prefix + "%"))
                )
            else:
                stmt = stmt.where(Note.area_id == area_id)
        if project_id is not None:
            stmt = stmt.where(Note.project_id == project_id)
        if pinned is not None:
            stmt = stmt.where(Note.pinned == pinned)
        if archived is not None:
            stmt = stmt.where(
                Note.archived_at.is_not(None) if archived else Note.archived_at.is_(None)
            )
        if q:
            stmt = stmt.where(Note.content.ilike(f"%{q}%"))
        stmt = stmt.order_by(Note.pinned.desc(), Note.order_index)
        if limit is not None:
            stmt = stmt.limit(limit)
        if offset is not None:
            stmt = stmt.offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all()
    async def get_note(self, note_id: int) -> Note | None:
        """Fetch a single note by its identifier."""

        return await self.session.get(Note, note_id)

    async def update_note(
        self,
        note_id: int,
        *,
        content: str | None = None,
        area_id: int | None = None,
        project_id: int | None = None,
        title: str | None = None,
        pinned: bool | None = None,
        archived_at: datetime | None = None,
    ) -> Note | None:
        """Update note fields and return the updated note."""

        note = await self.session.get(Note, note_id)
        if note is None:
            return None
        if content is not None:
            note.content = content
        if area_id is not None:
            note.area_id = area_id
        if project_id is not None:
            note.project_id = project_id
        if title is not None:
            note.title = title
        if pinned is not None:
            note.pinned = pinned
        if archived_at is not None:
            note.archived_at = archived_at
        await self.session.flush()
        return note

    async def assign_container(
        self, note_id: int, *, owner_id: int, container_type: ContainerType, container_id: int
    ) -> Note | None:
        note = await self.session.get(Note, note_id)
        if note is None or note.owner_id != owner_id:
            return None
        note.container_type = container_type
        note.container_id = container_id
        await self.session.flush()
        return note

    async def archive(self, note_id: int, *, owner_id: int) -> bool:
        from core.utils import utcnow

        note = await self.session.get(Note, note_id)
        if note is None or note.owner_id != owner_id:
            return False
        note.archived_at = utcnow()
        await self.session.flush()
        return True

    async def unarchive(self, note_id: int, *, owner_id: int) -> bool:
        note = await self.session.get(Note, note_id)
        if note is None or note.owner_id != owner_id:
            return False
        note.archived_at = None
        await self.session.flush()
        return True

    async def reorder(
        self,
        owner_id: int,
        *,
        area_id: int | None = None,
        project_id: int | None = None,
        ids: List[int],
    ) -> None:
        for idx, nid in enumerate(ids):
            note = await self.session.get(Note, nid)
            if note is None or note.owner_id != owner_id:
                continue
            if area_id is not None:
                note.area_id = area_id
            if project_id is not None:
                note.project_id = project_id
            note.order_index = idx
        await self.session.flush()

    async def backlinks(self, note_id: int) -> List[Link]:
        """Return links targeting this note (reference backlinks)."""
        stmt = (
            select(Link)
            .where(Link.target_type == "note")
            .where(Link.target_id == note_id)
            .where(Link.link_type == LinkType.reference)
        )
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def delete_note(self, note_id: int) -> bool:
        """Delete note by id. Returns ``True`` if deleted."""

        note = await self.session.get(Note, note_id)
        if note is None:
            return False
        await self.session.delete(note)
        await self.session.flush()
        return True
