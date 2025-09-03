from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.models import Note, TgUser
from core.services.note_service import NoteService
from web.dependencies import get_current_tg_user


router = APIRouter(prefix="/inbox", tags=["inbox"])


class InboxNote(BaseModel):
    id: int
    title: str | None = None
    content: str

    @classmethod
    def from_model(cls, n: Note) -> "InboxNote":
        return cls(id=n.id, title=getattr(n, "title", None), content=n.content)


@router.get("/notes", response_model=List[InboxNote])
async def list_inbox_notes(current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as svc:
        notes = await svc.list_inbox(owner_id=current_user.telegram_id)
    return [InboxNote.from_model(n) for n in notes]


# Alias for centralized API mounting
api = router

