from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from core.models import WebUser
from core.services.profile_service import ProfileService, ProfileAccess
from core.services.web_user_service import WebUserService
from web.dependencies import get_current_web_user
from ..template_env import templates

router = APIRouter(prefix="/users", include_in_schema=False, tags=["users"])


def _build_profile_context(access: ProfileAccess) -> dict[str, Any]:
    profile = access.profile
    sections = access.sections if isinstance(access.sections, list) else []
    grants = []
    if access.is_owner or access.is_admin:
        for grant in profile.grants:
            grants.append(
                {
                    "audience_type": grant.audience_type,
                    "subject_id": grant.subject_id,
                    "sections": list(grant.sections or []),
                    "expires_at": grant.expires_at,
                }
            )
    return {
        "slug": profile.slug,
        "display_name": profile.display_name,
        "headline": profile.headline,
        "summary": profile.summary,
        "avatar_url": profile.avatar_url,
        "cover_url": profile.cover_url,
        "tags": list(profile.tags or []),
        "meta": profile.profile_meta or {},
        "sections": sections,
        "grants": grants,
        "can_edit": access.is_owner or access.is_admin,
        "is_owner": access.is_owner,
    }


@router.get("")
async def users_catalog(
    request: Request,
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    query = request.query_params.get("q")
    async with ProfileService() as service:
        items = await service.list_catalog(
            entity_type="user",
            viewer=current_user,
            limit=200,
            offset=0,
            search=query,
        )
    context = {
        "current_user": current_user,
        "profiles": [
            {
                "slug": access.profile.slug,
                "display_name": access.profile.display_name,
                "headline": access.profile.headline,
                "summary": access.profile.summary,
                "avatar_url": access.profile.avatar_url,
                "sections": access.sections,
            }
            for access in items
        ],
        "search": query or "",
        "MODULE_TITLE": "Команда",
        "page_title": "Каталог пользователей",
    }
    return templates.TemplateResponse(request, "users/index.html", context)


@router.get("/{slug}")
async def view_user_profile(
    slug: str,
    request: Request,
    edit: bool = False,
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    async with ProfileService() as service:
        try:
            access = await service.get_profile(
                entity_type="user",
                slug=slug,
                viewer=current_user,
            )
        except ValueError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    profile_ctx = _build_profile_context(access)
    async with WebUserService() as users:
        profile_user = await users.get_by_id(access.profile.entity_id)
    context = {
        "current_user": current_user,
        "profile": profile_ctx,
        "profile_user": profile_user,
        "editing": edit and profile_ctx["can_edit"],
        "MODULE_TITLE": profile_ctx["display_name"],
        "page_title": profile_ctx["display_name"],
    }
    return templates.TemplateResponse(request, "users/detail.html", context)


@router.post("/{slug}")
async def update_user_profile(
    slug: str,
    request: Request,
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with ProfileService() as service:
        try:
            access = await service.get_profile(
                entity_type="user",
                slug=slug,
                viewer=current_user,
                with_sections=False,
            )
        except ValueError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    if not access.is_owner and not access.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    form = await request.form()
    data = dict(form)
    tags = data.get("tags")
    if isinstance(tags, str):
        data["tags"] = [tag.strip() for tag in tags.split(",") if tag.strip()]
    else:
        data.pop("tags", None)
    async with WebUserService() as users:
        await users.update_profile(access.profile.entity_id, data)
    return RedirectResponse(f"/users/{slug}", status_code=status.HTTP_303_SEE_OTHER)


api = router
