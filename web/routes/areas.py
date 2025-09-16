from __future__ import annotations

from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from core.models import Area, TgUser
from core.services.para_service import ParaService
from core.services.area_service import AreaService
from core.services.profile_service import ProfileService, ProfileAccess
from web.dependencies import get_current_tg_user


router = APIRouter(prefix="/areas", tags=["areas"])
ui_router = APIRouter(prefix="/areas", tags=["areas"], include_in_schema=False)


class AreaCreate(BaseModel):
    name: str
    color: Optional[str] = None
    review_interval_days: int = 7
    parent_id: Optional[int] = None


class AreaResponse(BaseModel):
    id: int
    name: str
    color: Optional[str]
    review_interval_days: int
    parent_id: Optional[int] = None
    depth: int = 0
    slug: str
    mp_path: str

    @classmethod
    def from_model(cls, area: Area) -> "AreaResponse":
        return cls(
            id=area.id,
            name=area.name,
            color=area.color,
            review_interval_days=getattr(area, "review_interval_days", 7),
            parent_id=getattr(area, "parent_id", None),
            depth=getattr(area, "depth", 0),
            slug=getattr(area, "slug", ""),
            mp_path=getattr(area, "mp_path", ""),
        )


@router.get("", response_model=List[AreaResponse])
async def list_areas(current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with ParaService() as svc:
        items = await svc.list_areas(owner_id=current_user.telegram_id)
    return [AreaResponse.from_model(a) for a in items]


@router.post("", response_model=AreaResponse, status_code=status.HTTP_201_CREATED)
async def create_area(payload: AreaCreate, current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with AreaService() as svc:
        area = await svc.create_area(
            owner_id=current_user.telegram_id,
            name=payload.name,
            parent_id=payload.parent_id,
            color=payload.color,
        )
    return AreaResponse.from_model(area)


@ui_router.get("")
async def areas_page_redirect() -> RedirectResponse:
    return RedirectResponse("/settings#areas", status_code=status.HTTP_307_TEMPORARY_REDIRECT)



class AreaMovePayload(BaseModel):
    new_parent_id: Optional[int] = None


@router.post("/{area_id}/move", response_model=AreaResponse)
async def move_area(area_id: int, payload: AreaMovePayload, current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with AreaService() as svc:
        area = await svc.get(area_id)
        if not area or area.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        try:
            area = await svc.move_area(area_id, payload.new_parent_id)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return AreaResponse.from_model(area)


class AreaRenamePayload(BaseModel):
    name: str


@router.post("/{area_id}/rename", response_model=AreaResponse)
async def rename_area(area_id: int, payload: AreaRenamePayload, current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with AreaService() as svc:
        area = await svc.get(area_id)
        if not area or area.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        # rename by changing slug and rebuilding prefixes via move
        from core.services.area_service import _slugify
        new_slug = await svc._unique_slug(area.owner_id, _slugify(payload.name))
        area.name = payload.name
        area.slug = new_slug
        await svc.move_area(area_id, area.parent_id)
    return AreaResponse.from_model(area)


# Alias for centralized API mounting
api = router
