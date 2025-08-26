from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.models import Note, TgUser
from core.services.note_service import NoteService
from web.dependencies import get_current_tg_user


router = APIRouter(prefix="/notes", tags=["notes"])


class NoteCreate(BaseModel):
    """Payload for creating a note."""

    content: str


class NoteResponse(BaseModel):
    """Representation of a note."""

    id: int
    content: str

    @classmethod
    def from_model(cls, note: Note) -> "NoteResponse":
        return cls(id=note.id, content=note.content)


@router.get("", response_model=List[NoteResponse])
async def list_notes(
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """List notes for the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as service:
        notes = await service.list_notes(owner_id=current_user.telegram_id)
    return [NoteResponse.from_model(n) for n in notes]


@router.post(
    "",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_note(
    payload: NoteCreate,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Create a note for the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as service:
        note = await service.create_note(
            owner_id=current_user.telegram_id,
            content=payload.content,
        )
    return NoteResponse.from_model(note)
