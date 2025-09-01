from __future__ import annotations

from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.models import WebUser, UserRole
from core.services.user_settings_service import UserSettingsService
from web.dependencies import get_current_web_user
from .settings import FAVORITE_PAGES

router = APIRouter(prefix="/user/settings", tags=["user-settings"])

DEFAULT_KEYS = ["dashboard_layout", "favorites"]

# Build default favorites dynamically based on accessible pages
def _default_favorites(role: UserRole) -> dict:
    items = []
    for page in FAVORITE_PAGES:
        if role >= page["min_role"]:
            items.append(
                {
                    "label": page["label"],
                    "path": page["path"],
                    "position": len(items) + 1,
                }
            )
    return {"v": 1, "items": items}

DEFAULT_DASHBOARD_LAYOUT = {
    "v": 1,
    "columns": 12,
    "gutter": 12,
    "layouts": {
        "lg": [
            {"id": "profile_card", "x": 0, "y": 0, "w": 4, "h": 2},
            {"id": "today", "x": 4, "y": 0, "w": 5, "h": 2},
            {"id": "quick_note", "x": 9, "y": 0, "w": 3, "h": 2},
            {"id": "upcoming_tasks", "x": 4, "y": 4, "w": 4, "h": 2},
            {"id": "reminders", "x": 8, "y": 4, "w": 4, "h": 2},
            {"id": "next_events", "x": 8, "y": 6, "w": 4, "h": 2},
            {"id": "habits", "x": 0, "y": 4, "w": 4, "h": 2},
        ],
        "md": [],
        "sm": [],
    },
    "widgets": [],
}


class SettingIn(BaseModel):
    value: Dict


@router.get("")
async def list_settings(
    keys: Optional[str] = None, current_user: WebUser | None = Depends(get_current_web_user)
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    want = [k.strip() for k in keys.split(",")] if keys else DEFAULT_KEYS
    result: Dict[str, Dict | None] = {}
    role_enum = UserRole[current_user.role] if getattr(current_user, "role", None) else UserRole.single
    async with UserSettingsService() as svc:
        for key in want:
            val = await svc.get(current_user.id, key)
            if val is None:
                if key == "favorites":
                    val = _default_favorites(role_enum)
                elif key == "dashboard_layout":
                    val = DEFAULT_DASHBOARD_LAYOUT
            result[key] = val
    return result


@router.get("/{key}")
async def get_setting(
    key: str, current_user: WebUser | None = Depends(get_current_web_user)
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with UserSettingsService() as svc:
        value = await svc.get(current_user.id, key)
    if value is None:
        role_enum = UserRole[current_user.role] if getattr(current_user, "role", None) else UserRole.single
        if key == "favorites":
            value = _default_favorites(role_enum)
        elif key == "dashboard_layout":
            value = DEFAULT_DASHBOARD_LAYOUT
    return {"key": key, "value": value}


@router.put("/{key}")
async def put_setting(
    key: str,
    payload: SettingIn,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    if not isinstance(payload.value, dict):
        raise HTTPException(status_code=400, detail="value must be object")
    # Minimal validation
    if key == "favorites":
        items = payload.value.get("items")
        if not isinstance(items, list):
            raise HTTPException(status_code=400, detail="items must be list")
        for it in items:
            if not isinstance(it, dict):
                raise HTTPException(status_code=400, detail="invalid item")
            if not isinstance(it.get("path"), str):
                raise HTTPException(status_code=400, detail="path required")
    elif key == "dashboard_layout":
        if not isinstance(payload.value.get("layouts"), dict):
            raise HTTPException(status_code=400, detail="layouts must be dict")
    async with UserSettingsService() as svc:
        value = await svc.upsert(current_user.id, key, payload.value)
    return {"ok": True, "key": key, "value": value}
