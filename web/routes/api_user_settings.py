from __future__ import annotations

from typing import Dict, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from core.models import WebUser
from core.services.user_settings_service import UserSettingsService
from web.dependencies import get_current_web_user, get_effective_permissions
from .settings import FAVORITE_PAGES

router = APIRouter(prefix="/user/settings", tags=["user-settings"])

DEFAULT_KEYS = ["dashboard_layout", "favorites"]


def _allowed_favorite_pages(effective) -> list[dict]:
    pages: list[dict] = []
    for page in FAVORITE_PAGES:
        allowed = False
        if effective:
            if page.get("role"):
                allowed = effective.has_role(page["role"])
            elif page.get("permission"):
                allowed = effective.has(page["permission"])
            else:
                allowed = True
        else:
            allowed = not page.get("role") and not page.get("permission")
        if allowed:
            pages.append({"path": page["path"], "label": page["label"]})
    return pages


def _default_favorites(effective) -> dict:
    allowed = _allowed_favorite_pages(effective)
    return {
        "v": 1,
        "items": [
            {"label": page["label"], "path": page["path"], "position": idx + 1}
            for idx, page in enumerate(allowed)
        ],
    }


def _normalize_favorite_path(raw: str | None) -> str | None:
    if not raw:
        return None
    value = raw.strip()
    if not value:
        return None
    if value.startswith(("http://", "https://")):
        parsed = urlparse(value)
        if not parsed.path:
            return None
        value = parsed.path
        if parsed.fragment:
            value = f"{value}#{parsed.fragment}"
    if value.startswith("//"):
        return None
    if not value.startswith("/"):
        return None
    return value


def _sanitize_favorites(value: Dict | None, effective) -> dict:
    allowed_pages = _allowed_favorite_pages(effective)
    allowed_map = {page["path"]: page["label"] for page in allowed_pages}
    version = 1
    sanitized: list[dict] = []
    items = []
    if isinstance(value, dict):
        maybe_version = value.get("v")
        if isinstance(maybe_version, int) and maybe_version > 0:
            version = maybe_version
        maybe_items = value.get("items")
        if isinstance(maybe_items, list):
            items = maybe_items
    for raw in items:
        if not isinstance(raw, dict):
            continue
        path = _normalize_favorite_path(raw.get("path"))
        if not path:
            continue
        if path not in allowed_map:
            continue
        if any(existing["path"] == path for existing in sanitized):
            continue
        label = raw.get("label")
        if isinstance(label, str):
            label = label.strip()
        if not label:
            label = allowed_map[path]
        sanitized.append({"label": label, "path": path})
    for idx, item in enumerate(sanitized, start=1):
        item["position"] = idx
    return {"v": version, "items": sanitized}


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
    request: Request,
    keys: Optional[str] = None,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    want = [k.strip() for k in keys.split(",")] if keys else DEFAULT_KEYS
    result: Dict[str, Dict | None] = {}
    effective = await get_effective_permissions(
        request, current_user=current_user
    )
    async with UserSettingsService() as svc:
        for key in want:
            val = await svc.get(current_user.id, key)
            if val is None:
                if key == "favorites":
                    val = _default_favorites(effective)
                elif key == "dashboard_layout":
                    val = DEFAULT_DASHBOARD_LAYOUT
            elif key == "favorites":
                sanitized = _sanitize_favorites(val, effective)
                if sanitized != val:
                    await svc.upsert(current_user.id, key, sanitized)
                    val = sanitized
            result[key] = val
    return result


@router.get("/{key}")
async def get_setting(
    request: Request,
    key: str,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    effective = await get_effective_permissions(
        request, current_user=current_user
    )
    async with UserSettingsService() as svc:
        value = await svc.get(current_user.id, key)
    if key == "favorites":
        if value is None:
            value = _default_favorites(effective)
        else:
            sanitized = _sanitize_favorites(value, effective)
            if sanitized != value:
                async with UserSettingsService() as svc:
                    await svc.upsert(current_user.id, key, sanitized)
                value = sanitized
    elif key == "dashboard_layout" and value is None:
        value = DEFAULT_DASHBOARD_LAYOUT
    return {"key": key, "value": value}


@router.put("/{key}")
async def put_setting(
    request: Request,
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
    effective = await get_effective_permissions(
        request, current_user=current_user
    )
    value_to_store = payload.value
    if key == "favorites":
        value_to_store = _sanitize_favorites(payload.value, effective)
    async with UserSettingsService() as svc:
        value = await svc.upsert(current_user.id, key, value_to_store)
    return {"ok": True, "key": key, "value": value}
