from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from core.models import Note, TgUser
from core.services.note_service import NoteService
from web.dependencies import get_current_tg_user, get_current_web_user
from core.models import WebUser
from ..template_env import templates


router = APIRouter(prefix="/api/notes", tags=["notes"])
ui_router = APIRouter(prefix="/notes", tags=["notes"], include_in_schema=False)


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


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Delete a note owned by the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as service:
        note = await service.get_note(note_id)
        if note is None or note.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        await service.delete_note(note_id)


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    payload: NoteCreate,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Update a note owned by the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as service:
        note = await service.get_note(note_id)
        if note is None or note.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        note = await service.update_note(note_id, payload.content)
    return NoteResponse.from_model(note)


@ui_router.get("")
async def notes_page(
    request: Request,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    """Render simple UI for notes with role-aware header."""

    context = {
        "current_user": current_user,
        "current_role_name": getattr(current_user, "role", ""),
        "is_admin": getattr(current_user, "role", "") == "admin",
        "page_title": "Заметки",
    }
    return templates.TemplateResponse(request, "notes.html", context)
