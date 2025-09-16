from __future__ import annotations

from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from core.models import Resource, TgUser, WebUser
from core.services.para_service import ParaService
from core.services.profile_service import ProfileService, ProfileAccess
from web.dependencies import get_current_tg_user, get_current_web_user
from ..template_env import templates


router = APIRouter(prefix="/resources", tags=["resources"])


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


def _build_profile_context(access: ProfileAccess) -> dict[str, Any]:
    profile = access.profile
    return {
        "slug": profile.slug,
        "display_name": profile.display_name,
        "headline": profile.headline,
        "summary": profile.summary,
        "avatar_url": profile.avatar_url,
        "cover_url": profile.cover_url,
        "meta": profile.profile_meta or {},
        "tags": list(profile.tags or []),
        "sections": access.sections,
        "can_edit": access.is_owner or access.is_admin,
        "is_owner": access.is_owner,
        "grants": [
            {
                "audience_type": grant.audience_type,
                "subject_id": grant.subject_id,
                "sections": list(grant.sections or []),
                "expires_at": grant.expires_at,
            }
            for grant in profile.grants
        ],
    }


@ui_router.get("/{slug}")
async def resource_profile_page(
    slug: str,
    request: Request,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    async with ProfileService() as service:
        try:
            access = await service.get_profile(
                entity_type="resource",
                slug=slug,
                viewer=current_user,
            )
        except ValueError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    profile_ctx = _build_profile_context(access)
    context = {
        "current_user": current_user,
        "profile": profile_ctx,
        "entity": "resources",
        "catalog_path": "/resources",
        "MODULE_TITLE": f"Ресурс: {profile_ctx['display_name']}",
        "page_title": profile_ctx['display_name'],
    }
    return templates.TemplateResponse(request, "profiles/detail.html", context)


# Alias for centralized API mounting
api = router
