"""Service layer for note operations."""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import Note


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

    async def list_notes(self, owner_id: Optional[int] = None) -> List[Note]:
        stmt = select(Note)
        if owner_id is not None:
            stmt = stmt.where(Note.owner_id == owner_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
