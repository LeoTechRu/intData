from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from core.models import Note, TgUser, WebUser
from core.services.note_service import NoteService
from web.dependencies import get_current_tg_user, get_current_web_user
from ..template_env import templates


router = APIRouter(tags=["inbox"])
ui_router = APIRouter(prefix="/inbox", tags=["inbox"], include_in_schema=False)


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


@ui_router.get("")
async def inbox_page(request: Request, current_user: WebUser | None = Depends(get_current_web_user)):
    context = {
        "current_user": current_user,
        "current_role_name": getattr(current_user, "role", ""),
        "is_admin": getattr(current_user, "role", "") == "admin",
        "page_title": "Inbox",
    }
    return templates.TemplateResponse(request, "inbox.html", context)


# Alias for centralized API mounting
api = router

