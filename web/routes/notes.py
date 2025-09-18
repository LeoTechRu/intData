from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from core.models import ContainerType, Note, TgUser
from core.services.note_service import NoteService
from core.services.para_service import ParaService
from web.dependencies import get_current_tg_user, get_current_web_user
from .index import render_next_page

router = APIRouter(prefix="/notes", tags=["notes"])
ui_router = APIRouter(prefix="/notes", tags=["notes"], include_in_schema=False)


class NoteCreate(BaseModel):
    title: Optional[str] = None
    content: str
    area_id: Optional[int] = None
    project_id: Optional[int] = None
    pinned: bool = False


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    area_id: Optional[int] = None
    project_id: Optional[int] = None
    pinned: Optional[bool] = None
    archived_at: Optional[datetime] = None


class AreaOut(BaseModel):
    id: int
    name: str
    slug: Optional[str] = None
    color: Optional[str] = None


class ProjectOut(BaseModel):
    id: int
    name: str


class NoteResponse(BaseModel):
    id: int
    title: Optional[str] = None
    content: str
    pinned: bool = False
    archived_at: Optional[datetime] = None
    order_index: int
    area_id: int
    project_id: Optional[int] = None
    color: str
    area: AreaOut
    project: Optional[ProjectOut] = None

    @classmethod
    def from_model(cls, note: Note) -> "NoteResponse":
        area = note.area
        project = note.project
        return cls(
            id=note.id,
            title=note.title,
            content=note.content,
            pinned=note.pinned,
            archived_at=note.archived_at,
            order_index=note.order_index,
            area_id=area.id,
            project_id=project.id if project else None,
            color=getattr(area, "color", None) or "#F1F5F9",
            area=AreaOut(
                id=area.id,
                name=area.name,
                slug=getattr(area, "slug", None),
                color=getattr(area, "color", None),
            ),
            project=ProjectOut(id=project.id, name=project.name) if project else None,
        )


class NoteReorder(BaseModel):
    area_id: Optional[int] = None
    project_id: Optional[int] = None
    ids: List[int]


class NoteAssign(BaseModel):
    container_type: ContainerType
    container_id: int


@router.get("", response_model=List[NoteResponse])
async def list_notes(
    current_user: TgUser | None = Depends(get_current_tg_user),
    area_id: Optional[int] = Query(default=None),
    project_id: Optional[int] = Query(default=None),
    pinned: Optional[bool] = Query(default=None),
    archived: bool = Query(default=False),
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=100),
    offset: int = Query(default=0),
    include_sub: int | None = Query(default=0),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as service:
        notes = await service.list_notes(
            owner_id=current_user.telegram_id,
            area_id=area_id,
            include_sub=bool(include_sub),
            project_id=project_id,
            pinned=pinned,
            archived=archived,
            q=q,
            limit=limit,
            offset=offset,
        )
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
    area_id = payload.area_id
    if area_id is None:
        async with ParaService() as psvc:
            areas = await psvc.list_areas(owner_id=current_user.telegram_id)
            inbox = next(
                (
                    a
                    for a in areas
                    if (getattr(a, "slug", "") or "").lower() == "inbox"
                    or a.name.lower() == "входящие"
                ),
                None,
            )
            if inbox is None:
                inbox = await psvc.create_area(
                    owner_id=current_user.telegram_id, name="Входящие"
                )
                inbox.slug = "inbox"
                inbox.color = "#FFF8B8"
                await psvc.session.flush()
            area_id = inbox.id
    async with NoteService() as service:
        note = await service.create_note(
            owner_id=current_user.telegram_id,
            title=payload.title,
            content=payload.content,
            area_id=area_id,
            project_id=payload.project_id,
            pinned=payload.pinned,
        )
        await service.session.refresh(note, attribute_names=["area", "project"])
        result = NoteResponse.from_model(note)
    return result


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
async def note_backlinks(
    note_id: int, current_user: TgUser | None = Depends(get_current_tg_user)
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as service:
        note = await service.get_note(note_id)
        if note is None or note.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        links = await service.backlinks(note_id)
    # Minimal payload
    return [
        {
            "id": l.id,
            "source_type": l.source_type,
            "source_id": l.source_id,
            "link_type": l.link_type.value,
        }
        for l in links
    ]


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


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    payload: NoteUpdate,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as service:
        note = await service.get_note(note_id)
        if note is None or note.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        note = await service.update_note(
            note_id,
            title=payload.title,
            content=payload.content,
            area_id=payload.area_id,
            project_id=payload.project_id,
            pinned=payload.pinned,
            archived_at=payload.archived_at,
        )
        await service.session.refresh(note, attribute_names=["area", "project"])
        result = NoteResponse.from_model(note)
    return result


@router.post("/{note_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
async def archive_note(
    note_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as service:
        ok = await service.archive(note_id, owner_id=current_user.telegram_id)
        if not ok:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{note_id}/unarchive", status_code=status.HTTP_204_NO_CONTENT)
async def unarchive_note(
    note_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as service:
        ok = await service.unarchive(note_id, owner_id=current_user.telegram_id)
        if not ok:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_notes(
    payload: NoteReorder,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with NoteService() as service:
        await service.reorder(
            owner_id=current_user.telegram_id,
            area_id=payload.area_id,
            project_id=payload.project_id,
            ids=payload.ids,
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@ui_router.get("", include_in_schema=False, response_class=HTMLResponse)
@ui_router.get("/", include_in_schema=False, response_class=HTMLResponse)
async def notes_page(
    current_user: TgUser | None = Depends(get_current_tg_user),  # noqa: ARG001 - retained for auth side-effects
    _web_user = Depends(get_current_web_user),  # noqa: ARG001 - ensures cookie refresh
):
    return render_next_page("notes")


# Alias for centralized API mounting
api = router
