from __future__ import annotations

import os
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from core.models import WebUser
from core.services.navigation_service import (
    NAV_BLUEPRINT,
    allowed_blueprint,
    build_navigation_payload,
    delete_user_layout,
    reset_global_layout,
    sanitize_layout,
    save_global_layout,
    save_user_layout,
)
from web.dependencies import get_current_web_user, get_effective_permissions

router = APIRouter(prefix="/navigation", tags=["navigation"])


class LayoutUpdate(BaseModel):
    layout: Optional[Dict] = None
    reset: bool = False


def _legacy_base() -> Optional[str]:
    env_value = os.getenv("NEXT_PUBLIC_LEGACY_APP_BASE") or os.getenv("LEGACY_APP_BASE")
    if not env_value:
        return None
    return env_value.rstrip("/")


def _can_edit_global(effective) -> bool:
    if not effective:
        return False
    if effective.has_role("admin"):
        return True
    return effective.has("app.settings.manage")


@router.get("/sidebar")
async def get_sidebar(
    request: Request,
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    effective = await get_effective_permissions(request, current_user=current_user)
    legacy = _legacy_base()
    can_edit_global = _can_edit_global(effective)
    payload = await build_navigation_payload(
        user_id=current_user.id if current_user else None,
        viewer_role=current_user.role if current_user else None,
        effective=effective,
        legacy_base=legacy,
        expose_global=can_edit_global,
    )
    return payload


@router.put("/sidebar/user")
async def put_sidebar_user(
    request: Request,
    payload: LayoutUpdate,
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    effective = await get_effective_permissions(request, current_user=current_user)
    blueprint = allowed_blueprint(effective, current_user.role)
    allowed_keys = [item.key for item in blueprint]
    sanitized = sanitize_layout(payload.layout, allowed_keys)
    if payload.reset or payload.layout is None:
        await delete_user_layout(current_user.id)
    else:
        await save_user_layout(current_user.id, sanitized)
    legacy = _legacy_base()
    can_edit_global = _can_edit_global(effective)
    refreshed = await build_navigation_payload(
        user_id=current_user.id,
        viewer_role=current_user.role,
        effective=effective,
        legacy_base=legacy,
        expose_global=can_edit_global,
    )
    return {"ok": True, "payload": refreshed}


@router.put("/sidebar/global")
async def put_sidebar_global(
    request: Request,
    payload: LayoutUpdate,
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    effective = await get_effective_permissions(request, current_user=current_user)
    if not _can_edit_global(effective):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    allowed_keys = [item.key for item in NAV_BLUEPRINT]
    if payload.reset:
        await reset_global_layout()
    else:
        sanitized = sanitize_layout(payload.layout, allowed_keys)
        await save_global_layout(sanitized)
    return {"ok": True}
