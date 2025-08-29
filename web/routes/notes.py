from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from pydantic import BaseModel

from core.models import Note, TgUser, ContainerType
from core.services.note_service import NoteService
from web.dependencies import get_current_tg_user, get_current_web_user
from core.models import WebUser
from ..template_env import templates


router = APIRouter(prefix="/api/v1/notes", tags=["notes"])
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


class NoteAssign(BaseModel):
    container_type: ContainerType
    container_id: int


@router.get("", response_model=List[NoteResponse])
async def list_notes(
    current_user: TgUser | None = Depends(get_current_tg_user),
    container_type: Optional[ContainerType] = Query(default=None),
    container_id: Optional[int] = Query(default=None),
    include_sub: Optional[int] = Query(default=0),
):
    """List notes for the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as service:
        notes = await service.list_notes(owner_id=current_user.telegram_id, container_type=container_type, container_id=container_id, include_sub=bool(include_sub))
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


@router.post("/{note_id}/assign", response_model=NoteResponse)
async def assign_note(
    note_id: int,
    payload: NoteAssign,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as service:
        note = await service.get_note(note_id)
        if note is None or note.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        note = await service.assign_container(
            note_id,
            owner_id=current_user.telegram_id,
            container_type=payload.container_type,
            container_id=payload.container_id,
        )
    return NoteResponse.from_model(note)


@router.get("/{note_id}/backlinks")
async def note_backlinks(note_id: int, current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as service:
        note = await service.get_note(note_id)
        if note is None or note.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        links = await service.backlinks(note_id)
    # Minimal payload
    return [{"id": l.id, "source_type": l.source_type, "source_id": l.source_id, "link_type": l.link_type.value} for l in links]


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
