from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel

from core.models import WebUser
from core.services.favorite_service import FavoriteService
from web.dependencies import get_current_web_user


router = APIRouter(prefix="/api/user/favorites", tags=["favorites"])


class FavCreate(BaseModel):
    label: str
    path: str


class FavUpdate(BaseModel):
    label: Optional[str] = None
    position: Optional[int] = None


@router.get("/")
async def list_favorites(current_user: WebUser | None = Depends(get_current_web_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with FavoriteService() as svc:
        items = await svc.list_favorites(current_user.id)
    return [
        {"id": f.id, "label": f.label, "path": f.path, "position": f.position}
        for f in items
    ]


@router.post("/", status_code=201)
async def add_favorite(
    data: FavCreate, current_user: WebUser | None = Depends(get_current_web_user)
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with FavoriteService() as svc:
        try:
            fav = await svc.add_favorite(current_user.id, data.label, data.path)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return {"id": fav.id, "label": fav.label, "path": fav.path, "position": fav.position}


@router.put("/{fav_id}")
async def update_favorite(
    fav_id: int,
    data: FavUpdate,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with FavoriteService() as svc:
        fav = await svc.update_favorite(current_user.id, fav_id, data.label, data.position)
    if not fav:
        raise HTTPException(status_code=404, detail="not found")
    return {"id": fav.id, "label": fav.label, "path": fav.path, "position": fav.position}


@router.delete("/{fav_id}", status_code=204)
async def delete_favorite(
    fav_id: int, current_user: WebUser | None = Depends(get_current_web_user)
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with FavoriteService() as svc:
        await svc.remove_favorite(current_user.id, fav_id)
    return Response(status_code=204)
