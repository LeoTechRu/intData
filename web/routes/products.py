from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from core.models import WebUser
from core.services.crm_service import CRMService
from core.services.profile_service import ProfileService, ProfileAccess
from web.dependencies import get_current_web_user
from ..template_env import templates

router = APIRouter(prefix="/products", tags=["products"])
ui_router = APIRouter(prefix="/products", tags=["products"], include_in_schema=False)


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


@ui_router.get("")
async def products_catalog(
    request: Request,
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    async with CRMService() as crm:
        products = await crm.list_products(active_only=False)
    context = {
        "current_user": current_user,
        "products": products,
        "MODULE_TITLE": "Продукты",
        "page_title": "Продукты",
    }
    return templates.TemplateResponse(request, "products/index.html", context)


@ui_router.get("/{slug}")
async def product_profile_page(
    slug: str,
    request: Request,
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    async with ProfileService() as profiles:
        try:
            access = await profiles.get_profile(
                entity_type="product",
                slug=slug,
                viewer=current_user,
            )
        except ValueError:
            raise HTTPException(status_code=404)
        except PermissionError:
            raise HTTPException(status_code=403)
    profile_ctx = _build_profile_context(access)
    context = {
        "current_user": current_user,
        "profile": profile_ctx,
        "entity": "products",
        "catalog_path": "/products",
        "MODULE_TITLE": f"Продукт: {profile_ctx['display_name']}",
        "page_title": profile_ctx['display_name'],
    }
    return templates.TemplateResponse(request, "profiles/detail.html", context)


api = router
