from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

from core.logger import logger
from core.services.access_control import EffectivePermissions
from core.services.app_settings_service import (
    delete_settings_by_prefix,
    get_settings_by_prefix,
    upsert_settings,
)
from core.services.user_settings_service import UserSettingsService

NAV_VERSION = 1
GLOBAL_LAYOUT_KEY = "ui.nav.sidebar.layout"
GLOBAL_PREFIX = "ui.nav.sidebar."
PAYWALL_ROUTE = "/pricing"


@dataclass(frozen=True)
class NavStatus:
    kind: str
    link: Optional[str] = None

    def as_dict(self) -> Dict[str, str]:
        result: Dict[str, str] = {"kind": self.kind}
        if self.link:
            result["link"] = self.link
        return result


@dataclass(frozen=True)
class NavBlueprintItem:
    key: str
    label: str
    route: Optional[str]
    legacy: Optional[str] = None
    status: Optional[NavStatus] = None
    permissions: Tuple[str, ...] = ()
    roles: Tuple[str, ...] = ()


NAV_BLUEPRINT: Tuple[NavBlueprintItem, ...] = (
    NavBlueprintItem(
        key="overview",
        label="Обзор",
        route="/",
        status=NavStatus("new"),
        permissions=("app.dashboard.view",),
    ),
    NavBlueprintItem(
        key="inbox",
        label="Входящие",
        route="/inbox",
        permissions=("app.tasks.manage",),
    ),
    NavBlueprintItem(
        key="areas",
        label="Области",
        route="/areas",
        status=NavStatus("new"),
        permissions=("app.areas.manage",),
    ),
    NavBlueprintItem(
        key="projects",
        label="Проекты",
        route="/projects",
        status=NavStatus("new"),
        permissions=("app.projects.manage",),
    ),
    NavBlueprintItem(
        key="team",
        label="Команда",
        route="/users",
        status=NavStatus("new"),
        permissions=("app.users.invite",),
    ),
    NavBlueprintItem(
        key="resources",
        label="Ресурсы",
        route="/resources",
        status=NavStatus("wip"),
        permissions=("app.projects.manage",),
    ),
    NavBlueprintItem(
        key="tasks",
        label="Задачи",
        route="/tasks",
        status=NavStatus("wip"),
        permissions=("app.tasks.manage",),
    ),
    NavBlueprintItem(
        key="habits",
        label="Привычки",
        route="/habits",
        status=NavStatus("locked", PAYWALL_ROUTE),
        permissions=("app.habits.manage",),
    ),
    NavBlueprintItem(
        key="admin",
        label="ЛК Админа",
        route="/admin",
        status=NavStatus("new"),
        roles=("admin",),
    ),
)


def allowed_blueprint(
    effective: Optional[EffectivePermissions],
    viewer_role: Optional[str],
) -> List[NavBlueprintItem]:
    allowed: List[NavBlueprintItem] = []
    role_slug = viewer_role.lower() if viewer_role else None
    for item in NAV_BLUEPRINT:
        if item.roles:
            if role_slug and role_slug in item.roles:
                allowed.append(item)
                continue
            if effective and any(effective.has_role(role) for role in item.roles):
                allowed.append(item)
            continue
        if not item.permissions:
            allowed.append(item)
            continue
        if effective and effective.has_all(item.permissions):
            allowed.append(item)
    return allowed


def _default_layout(keys: Sequence[str]) -> Dict:
    return {
        "v": NAV_VERSION,
        "items": [
            {"key": key, "hidden": False, "position": index + 1}
            for index, key in enumerate(keys)
        ],
    }


def _sanitize_layout(raw: Optional[Dict], allowed_keys: Sequence[str]) -> Dict:
    order_map = {key: idx for idx, key in enumerate(allowed_keys)}
    seen: set[str] = set()
    items: List[Dict[str, object]] = []
    version = NAV_VERSION
    if isinstance(raw, dict):
        maybe_version = raw.get("v")
        if isinstance(maybe_version, int) and maybe_version > 0:
            version = maybe_version
        raw_items = raw.get("items")
        if isinstance(raw_items, list):
            for entry in raw_items:
                if not isinstance(entry, dict):
                    continue
                key = entry.get("key")
                if not isinstance(key, str) or key not in order_map or key in seen:
                    continue
                hidden = bool(entry.get("hidden", False))
                position = entry.get("position")
                if not isinstance(position, int) or position < 1:
                    position = len(items) + 1
                items.append({"key": key, "hidden": hidden, "position": position})
                seen.add(key)
    for key in allowed_keys:
        if key not in seen:
            items.append({"key": key, "hidden": False, "position": len(items) + 1})
    items.sort(key=lambda entry: (int(entry["position"]), order_map[entry["key"]]))
    for index, entry in enumerate(items, start=1):
        entry["position"] = index
    return {"v": version, "items": items}


def _merge_layouts(
    default_layout: Dict,
    global_layout: Dict,
    user_layout: Dict,
    *,
    user_has_custom: bool,
) -> List[Dict[str, object]]:
    def _ordered_keys(layout: Dict) -> List[str]:
        mapping = {
            entry["key"]: entry
            for entry in layout.get("items", [])
            if isinstance(entry, dict) and isinstance(entry.get("key"), str)
        }
        ordered = sorted(mapping.values(), key=lambda entry: int(entry.get("position", 0)) or 0)
        result: List[str] = []
        for entry in ordered:
            key = entry["key"]
            if key not in result:
                result.append(key)
        return result

    default_order = [entry["key"] for entry in default_layout["items"]]
    merged_order: List[str] = []
    order_sources = []
    if user_has_custom:
        order_sources.append(_ordered_keys(user_layout))
    order_sources.append(_ordered_keys(global_layout))
    for source in order_sources:
        for key in source:
            if key in default_order and key not in merged_order:
                merged_order.append(key)
    for key in default_order:
        if key not in merged_order:
            merged_order.append(key)

    hidden_state: Dict[str, bool] = {entry["key"]: bool(entry.get("hidden")) for entry in default_layout["items"]}
    for entry in global_layout.get("items", []):
        key = entry.get("key")
        if isinstance(key, str):
            hidden_state[key] = bool(entry.get("hidden", hidden_state.get(key, False)))
    if user_has_custom:
        for entry in user_layout.get("items", []):
            key = entry.get("key")
            if isinstance(key, str):
                hidden_state[key] = bool(entry.get("hidden", hidden_state.get(key, False)))

    merged: List[Dict[str, object]] = []
    for index, key in enumerate(merged_order, start=1):
        merged.append({"key": key, "hidden": hidden_state.get(key, False), "position": index})
    return merged


async def load_global_layout(allowed_keys: Sequence[str]) -> Dict:
    stored = await get_settings_by_prefix(GLOBAL_PREFIX)
    raw_value = stored.get(GLOBAL_LAYOUT_KEY)
    data = None
    if raw_value:
        try:
            data = json.loads(raw_value)
        except json.JSONDecodeError:
            logger.warning("navigation: invalid JSON in global layout, reverting to default")
    return _sanitize_layout(data, allowed_keys)


async def save_global_layout(layout: Dict) -> None:
    payload = json.dumps(layout, ensure_ascii=False, separators=(",", ":"))
    await upsert_settings({GLOBAL_LAYOUT_KEY: payload})


async def reset_global_layout() -> None:
    await delete_settings_by_prefix(GLOBAL_PREFIX)


async def load_user_layout(user_id: int, allowed_keys: Sequence[str]) -> Tuple[Dict, bool]:
    async with UserSettingsService() as svc:
        raw = await svc.get(user_id, "nav_sidebar")
    return _sanitize_layout(raw, allowed_keys), raw is not None


async def save_user_layout(user_id: int, layout: Dict) -> None:
    async with UserSettingsService() as svc:
        await svc.upsert(user_id, "nav_sidebar", layout)


async def delete_user_layout(user_id: int) -> None:
    async with UserSettingsService() as svc:
        await svc.delete(user_id, "nav_sidebar")


def sanitize_layout(raw: Optional[Dict], allowed_keys: Sequence[str]) -> Dict:
    return _sanitize_layout(raw, allowed_keys)


async def build_navigation_payload(
    *,
    user_id: Optional[int],
    viewer_role: Optional[str],
    effective: Optional[EffectivePermissions],
    legacy_base: Optional[str],
    expose_global: bool,
) -> Dict:
    allowed_items = allowed_blueprint(effective, viewer_role)
    allowed_keys = [item.key for item in allowed_items]
    default_layout = _default_layout(allowed_keys)
    global_layout = await load_global_layout(allowed_keys)
    if user_id is not None:
        user_layout, user_has_custom = await load_user_layout(user_id, allowed_keys)
    else:
        user_layout, user_has_custom = _default_layout(allowed_keys), False
    merged_items = _merge_layouts(
        default_layout,
        global_layout,
        user_layout,
        user_has_custom=user_has_custom,
    )

    base = legacy_base.rstrip("/") if legacy_base else None
    blueprint_map = {item.key: item for item in allowed_items}
    items_payload: List[Dict[str, object]] = []
    for entry in merged_items:
        key = entry["key"]
        item = blueprint_map.get(key)
        if not item:
            continue
        href = item.route
        external = False
        disabled = False
        if not href and item.legacy:
            if base:
                href = f"{base}{item.legacy}"
                external = True
            else:
                href = None
                disabled = True
        payload_entry: Dict[str, object] = {
            "key": key,
            "label": item.label,
            "hidden": entry["hidden"],
            "position": entry["position"],
            "external": external,
            "disabled": disabled,
        }
        if href and not disabled:
            payload_entry["href"] = href
        if item.status:
            payload_entry["status"] = item.status.as_dict()
        items_payload.append(payload_entry)

    result: Dict[str, object] = {
        "v": NAV_VERSION,
        "items": items_payload,
        "layout": {
            "user": user_layout,
            "global": global_layout if expose_global else None,
        },
        "can_edit_global": expose_global,
    }
    return result


__all__ = [
    "NAV_VERSION",
    "NAV_BLUEPRINT",
    "NavStatus",
    "NavBlueprintItem",
    "allowed_blueprint",
    "sanitize_layout",
    "load_global_layout",
    "save_global_layout",
    "reset_global_layout",
    "load_user_layout",
    "save_user_layout",
    "delete_user_layout",
    "build_navigation_payload",
]
