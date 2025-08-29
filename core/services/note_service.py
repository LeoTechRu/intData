"""Service layer for note operations."""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import Note, ContainerType, Link, LinkType, Area, ContainerType, Link, LinkType


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

    async def create_note(self, owner_id: int, content: str) -> Note:
        note = Note(owner_id=owner_id, content=content)
        self.session.add(note)
        await self.session.flush()
        return note

    async def list_notes(
        self,
        owner_id: Optional[int] = None,
        *,
        container_type: ContainerType | None = None,
        container_id: int | None = None,
        include_sub: bool = False,
    ) -> List[Note]:
        stmt = select(Note)
        if owner_id is not None:
            stmt = stmt.where(Note.owner_id == owner_id)
        if container_type is not None:
            stmt = stmt.where(Note.container_type == container_type)
            if container_type == ContainerType.area and container_id is not None and include_sub:
                node = await self.session.get(Area, container_id)
                if node:
                    from sqlalchemy import or_
                    stmt = (
                        select(Note)
                        .join(Area, Area.id == Note.container_id)
                        .where(Note.owner_id == owner_id)
                        .where(Note.container_type == ContainerType.area)
                        .where(or_(Area.mp_path == node.mp_path, Area.mp_path.like(node.mp_path + '%')))
                    )
                    result = await self.session.execute(stmt)
                    return result.scalars().all()
            if container_id is not None and not include_sub:
                stmt = stmt.where(Note.container_id == container_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
    async def get_note(self, note_id: int) -> Note | None:
        """Fetch a single note by its identifier."""

        return await self.session.get(Note, note_id)

    async def update_note(self, note_id: int, content: str) -> Note | None:
        """Update note content and return the updated note."""

        note = await self.session.get(Note, note_id)
        if note is None:
            return None
        note.content = content
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
