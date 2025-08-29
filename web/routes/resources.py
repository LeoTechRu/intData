from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from core.models import Resource, TgUser, WebUser
from core.services.para_service import ParaService
from web.dependencies import get_current_tg_user, get_current_web_user
from ..template_env import templates


router = APIRouter(prefix="/api/resources", tags=["resources"])
ui_router = APIRouter(prefix="/resources", tags=["resources"], include_in_schema=False)


class ResourceCreate(BaseModel):
    title: str
    content: Optional[str] = None
    type: Optional[str] = None


class ResourceResponse(BaseModel):
    id: int
    title: str
    type: Optional[str]

    @classmethod
    def from_model(cls, r: Resource) -> "ResourceResponse":
        return cls(id=r.id, title=r.title, type=r.type)


@router.get("", response_model=List[ResourceResponse])
async def list_resources(current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with ParaService() as svc:
        items = await svc.list_resources(owner_id=current_user.telegram_id)
    return [ResourceResponse.from_model(r) for r in items]


@router.post("", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
async def create_resource(payload: ResourceCreate, current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with ParaService() as svc:
        r = await svc.create_resource(
            owner_id=current_user.telegram_id,
            title=payload.title,
            content=payload.content,
            type=payload.type,
        )
    return ResourceResponse.from_model(r)


@ui_router.get("")
async def resources_page(request: Request, current_user: WebUser | None = Depends(get_current_web_user)):
    context = {
        "current_user": current_user,
        "current_role_name": getattr(current_user, "role", ""),
        "is_admin": getattr(current_user, "role", "") == "admin",
        "page_title": "Resources",
    }
    return templates.TemplateResponse(request, "resources.html", context)

