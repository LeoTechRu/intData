from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

import core.db as db
from core.logger import logger
from core.models import NavSidebarLayout
from core.services.access_control import EffectivePermissions
from core.services.app_settings_service import (
    delete_settings_by_prefix,
    get_settings_by_prefix,
)
from core.services.user_settings_service import UserSettingsService
from core.utils import utcnow

NAV_VERSION = 1
GLOBAL_LAYOUT_KEY = "ui.nav.sidebar.layout"
GLOBAL_PREFIX = "ui.nav.sidebar."
PAYWALL_ROUTE = "/tariffs"

MODULE_DEFINITIONS: Tuple[Tuple[str, str, str, int], ...] = (
    ("control", "Control Hub", "module-control-hub", 1000),
    ("tasks", "Задачи и проекты", "module-tasks-projects", 2000),
    ("knowledge", "База знаний", "module-knowledge", 3000),
    ("team", "Команда", "module-team", 4000),
    ("admin", "Администрирование", "module-admin", 5000),
)

MODULE_MAP: Dict[str, Tuple[str, str, int]] = {
    module_id: (label, icon, order)
    for module_id, label, icon, order in MODULE_DEFINITIONS
}

CATEGORY_DEFINITIONS: Tuple[Tuple[str, str, str, int], ...] = (
    ("control", "overview", "Обзор", 100),
    ("control", "inbox", "Входящие", 110),
    ("control", "calendar", "Календарь", 120),
    ("control", "time", "Время", 130),
    ("control", "reminders", "Напоминания", 140),
    ("tasks", "tasks", "Задачи", 300),
    ("tasks", "projects", "Проекты", 310),
    ("tasks", "areas", "Области", 320),
    ("tasks", "resources", "Ресурсы", 330),
    ("knowledge", "knowledge", "База знаний", 400),
    ("team", "people", "Команда", 500),
    ("team", "habits", "Привычки", 520),
    ("admin", "settings", "Настройки", 600),
    ("admin", "admin_tools", "Администрирование", 610),
)

CATEGORY_MAP: Dict[Tuple[str, str], Tuple[str, int]] = {
    (module, category): (label, order)
    for module, category, label, order in CATEGORY_DEFINITIONS
}


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
    module: str = 'general'
    section_order: int = 0
    category: str = 'general'
    icon: str = 'nav-generic'
    default_hidden: bool = False


@dataclass
class LayoutState:
    layout: Dict
    has_custom: bool
    version: int
    etag: str


class LayoutConflict(Exception):
    def __init__(self, *, current_version: int, etag: str) -> None:
        super().__init__("layout version conflict")
        self.current_version = current_version
        self.etag = etag


NAV_BLUEPRINT: Tuple[NavBlueprintItem, ...] = (
    NavBlueprintItem(
        key="overview",
        label="Обзор",
        route="/",
        status=NavStatus("new"),
        permissions=("app.dashboard.view",),
        module="control",
        section_order=100,
        category="overview",
        icon="overview",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="inbox",
        label="Входящие",
        route="/inbox",
        permissions=("app.tasks.manage",),
        module="control",
        section_order=110,
        category="inbox",
        icon="inbox",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="calendar",
        label="Календарь",
        route="/calendar",
        status=NavStatus("new"),
        permissions=("app.calendar.manage",),
        module="control",
        section_order=120,
        category="calendar",
        icon="calendar",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="time",
        label="Время",
        route="/time",
        status=NavStatus("new"),
        permissions=("app.tasks.manage",),
        module="control",
        section_order=130,
        category="time",
        icon="time",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="reminders",
        label="Напоминания",
        route="/reminders",
        status=NavStatus("new"),
        permissions=("app.tasks.manage",),
        module="control",
        section_order=140,
        category="reminders",
        icon="reminders",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="tasks",
        label="Задачи",
        route="/tasks",
        status=NavStatus("wip"),
        permissions=("app.tasks.manage",),
        module="tasks",
        section_order=300,
        category="tasks",
        icon="tasks",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="projects",
        label="Проекты",
        route="/projects",
        status=NavStatus("new"),
        permissions=("app.projects.manage",),
        module="tasks",
        section_order=310,
        category="projects",
        icon="projects",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="areas",
        label="Области",
        route="/areas",
        status=NavStatus("new"),
        permissions=("app.areas.manage",),
        module="tasks",
        section_order=320,
        category="areas",
        icon="areas",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="resources",
        label="Ресурсы",
        route="/resources",
        status=NavStatus("wip"),
        permissions=("app.projects.manage",),
        module="tasks",
        section_order=330,
        category="resources",
        icon="resources",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="notes",
        label="Заметки",
        route="/notes",
        status=NavStatus("new"),
        permissions=("app.tasks.manage",),
        module="knowledge",
        section_order=400,
        category="knowledge",
        icon="notes",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="products",
        label="Продукты",
        route="/products",
        status=NavStatus("new"),
        module="knowledge",
        section_order=410,
        category="knowledge",
        icon="products",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="habits",
        label="Привычки",
        route="/habits",
        status=NavStatus("locked", PAYWALL_ROUTE),
        permissions=("app.habits.manage",),
        module="team",
        section_order=500,
        category="habits",
        icon="habits",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="team",
        label="Команда",
        route="/users",
        status=NavStatus("new"),
        permissions=("app.users.invite",),
        module="team",
        section_order=510,
        category="people",
        icon="team",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="groups",
        label="Группы",
        route="/groups",
        status=NavStatus("new"),
        roles=("admin",),
        module="team",
        section_order=520,
        category="people",
        icon="groups",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="settings",
        label="Настройки",
        route="/settings",
        status=NavStatus("new"),
        module="admin",
        section_order=600,
        category="settings",
        icon="settings",
        default_hidden=True,
    ),
    NavBlueprintItem(
        key="admin",
        label="ЛК Админа",
        route="/admin",
        status=NavStatus("new"),
        roles=("admin",),
        module="admin",
        section_order=610,
        category="admin_tools",
        icon="admin",
        default_hidden=True,
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


def _default_layout(items: Sequence[NavBlueprintItem]) -> Dict:
    return {
        "v": NAV_VERSION,
        "items": [
            {
                "key": item.key,
                "hidden": item.default_hidden,
                "position": index + 1,
            }
            for index, item in enumerate(items)
        ],
    }


def _category_definition(module_id: str, category_id: str) -> Dict[str, object]:
    label, order = CATEGORY_MAP.get((module_id, category_id), (category_id.title(), 9000))
    return {
        "id": category_id,
        "module_id": module_id,
        "label": label,
        "order": order,
    }


def _make_etag(scope: str, owner_id: Optional[int], version: int) -> str:
    owner_part = "global" if owner_id is None else str(owner_id)
    return f"{scope}:{owner_part}:v{version}"


def _layout_filters(scope: str, owner_id: Optional[int]) -> List[Any]:
    filters: List[Any] = [NavSidebarLayout.scope == scope]
    if owner_id is None:
        filters.append(NavSidebarLayout.owner_id.is_(None))
    else:
        filters.append(NavSidebarLayout.owner_id == owner_id)
    return filters


async def _select_layout_record(
    session: AsyncSession,
    scope: str,
    owner_id: Optional[int],
) -> NavSidebarLayout | None:
    stmt = sa.select(NavSidebarLayout).where(*_layout_filters(scope, owner_id)).limit(1)
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def _load_layout_state(
    scope: str,
    owner_id: Optional[int],
    allowed_items: Sequence[NavBlueprintItem],
) -> LayoutState:
    allowed_keys = [item.key for item in allowed_items]
    defaults = {item.key: item.default_hidden for item in allowed_items}
    async with db.async_session() as session:
        record = await _select_layout_record(session, scope, owner_id)
    if record:
        layout = _sanitize_layout(record.payload, allowed_keys, defaults)
        return LayoutState(layout=layout, has_custom=True, version=record.version, etag=_make_etag(scope, owner_id, record.version))
    default_layout = _sanitize_layout(None, allowed_keys, defaults)
    return LayoutState(layout=default_layout, has_custom=False, version=0, etag=_make_etag(scope, owner_id, 0))


async def _load_legacy_user_layout(user_id: int) -> Optional[Dict]:
    async with UserSettingsService() as svc:
        return await svc.get(user_id, "nav_sidebar")


async def _clear_legacy_user_layout(user_id: int) -> None:
    async with UserSettingsService() as svc:
        await svc.delete(user_id, "nav_sidebar")


async def _maybe_migrate_global_layout(allowed_items: Sequence[NavBlueprintItem]) -> Optional[LayoutState]:
    stored = await get_settings_by_prefix(GLOBAL_PREFIX)
    raw_value = stored.get(GLOBAL_LAYOUT_KEY)
    if not raw_value:
        return None
    try:
        data = json.loads(raw_value)
    except json.JSONDecodeError:
        logger.warning("navigation: invalid JSON in legacy global layout; skipping migration")
        await delete_settings_by_prefix(GLOBAL_PREFIX)
        return None
    sanitized = sanitize_layout(data, allowed_items)
    await _persist_layout('global', None, sanitized, expected_version=0)
    await delete_settings_by_prefix(GLOBAL_PREFIX)
    return await _load_layout_state('global', None, allowed_items)


async def _load_global_layout_state(allowed_items: Sequence[NavBlueprintItem]) -> LayoutState:
    state = await _load_layout_state('global', None, allowed_items)
    if state.has_custom:
        return state
    migrated = await _maybe_migrate_global_layout(allowed_items)
    if migrated:
        return migrated
    return state


async def _load_user_layout_state(
    user_id: int,
    allowed_items: Sequence[NavBlueprintItem],
) -> LayoutState:
    state = await _load_layout_state('user', user_id, allowed_items)
    if state.has_custom:
        return state
    legacy = await _load_legacy_user_layout(user_id)
    if legacy is None:
        return state
    sanitized = sanitize_layout(legacy, allowed_items)
    await _persist_layout('user', user_id, sanitized, expected_version=0)
    await _clear_legacy_user_layout(user_id)
    return await _load_layout_state('user', user_id, allowed_items)


async def _resolve_layout_states(
    user_id: Optional[int],
    viewer_role: Optional[str],
    effective: Optional[EffectivePermissions],
) -> Tuple[
    Sequence[NavBlueprintItem],
    Dict,
    LayoutState,
    LayoutState,
    Dict,
]:
    allowed_items = allowed_blueprint(effective, viewer_role)
    default_layout = _default_layout(allowed_items)
    global_state = await _load_global_layout_state(allowed_items)
    if user_id is not None:
        user_state = await _load_user_layout_state(user_id, allowed_items)
    else:
        user_state = LayoutState(
            layout=default_layout,
            has_custom=False,
            version=0,
            etag=_make_etag('user', None, 0),
        )
    merged_items = _merge_layouts(
        default_layout,
        global_state.layout,
        user_state.layout,
        user_has_custom=user_state.has_custom,
    )
    merged_layout = {"v": NAV_VERSION, "items": merged_items}
    return allowed_items, default_layout, global_state, user_state, merged_layout


async def _persist_layout(
    scope: str,
    owner_id: Optional[int],
    layout: Dict,
    *,
    expected_version: Optional[int],
) -> int:
    async with db.async_session() as session:
        async with session.begin():
            record = await _select_layout_record(session, scope, owner_id)
            if record is None:
                if expected_version not in (None, 0):
                    raise LayoutConflict(current_version=0, etag=_make_etag(scope, owner_id, 0))
                new_record = NavSidebarLayout(
                    scope=scope,
                    owner_id=owner_id,
                    version=1,
                    payload=layout,
                )
                session.add(new_record)
                await session.flush()
                return new_record.version
            if expected_version is not None and expected_version != record.version:
                raise LayoutConflict(current_version=record.version, etag=_make_etag(scope, owner_id, record.version))
            record.payload = layout
            record.version = record.version + 1
            record.updated_at = utcnow()
            return record.version


async def _delete_layout(
    scope: str,
    owner_id: Optional[int],
    *,
    expected_version: Optional[int],
) -> None:
    async with db.async_session() as session:
        async with session.begin():
            record = await _select_layout_record(session, scope, owner_id)
            if record is None:
                if expected_version not in (None, 0):
                    raise LayoutConflict(current_version=0, etag=_make_etag(scope, owner_id, 0))
                return
            if expected_version is not None and expected_version != record.version:
                raise LayoutConflict(current_version=record.version, etag=_make_etag(scope, owner_id, record.version))
            await session.delete(record)

def _sanitize_layout(
    raw: Optional[Dict],
    allowed_keys: Sequence[str],
    default_hidden: Dict[str, bool],
) -> Dict:
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
                hidden_default = default_hidden.get(key, False)
                hidden = bool(entry.get("hidden", hidden_default))
                position = entry.get("position")
                if not isinstance(position, int) or position < 1:
                    position = len(items) + 1
                items.append({"key": key, "hidden": hidden, "position": position})
                seen.add(key)
    for key in allowed_keys:
        if key not in seen:
            items.append({
                "key": key,
                "hidden": default_hidden.get(key, False),
                "position": len(items) + 1,
            })
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


async def load_global_layout(allowed_items: Sequence[NavBlueprintItem]) -> Dict:
    state = await _load_global_layout_state(allowed_items)
    return state.layout


async def save_global_layout(layout: Dict) -> None:
    await _persist_layout('global', None, layout, expected_version=None)


async def reset_global_layout() -> None:
    await _delete_layout('global', None, expected_version=None)
    await delete_settings_by_prefix(GLOBAL_PREFIX)


async def load_user_layout(
    user_id: int,
    allowed_items: Sequence[NavBlueprintItem],
) -> Tuple[Dict, bool]:
    state = await _load_user_layout_state(user_id, allowed_items)
    return state.layout, state.has_custom


async def save_user_layout(user_id: int, layout: Dict) -> None:
    await _persist_layout('user', user_id, layout, expected_version=None)


async def delete_user_layout(user_id: int) -> None:
    await _delete_layout('user', user_id, expected_version=None)


def sanitize_layout(raw: Optional[Dict], allowed_items: Sequence[NavBlueprintItem]) -> Dict:
    allowed_keys = [item.key for item in allowed_items]
    defaults = {item.key: item.default_hidden for item in allowed_items}
    return _sanitize_layout(raw, allowed_keys, defaults)


async def build_navigation_payload(
    *,
    user_id: Optional[int],
    viewer_role: Optional[str],
    effective: Optional[EffectivePermissions],
    legacy_base: Optional[str],
    expose_global: bool,
) -> Dict:
    allowed_items, default_layout, global_state, user_state, merged_layout = await _resolve_layout_states(
        user_id,
        viewer_role,
        effective,
    )
    merged_items = merged_layout["items"]

    base = legacy_base.rstrip("/") if legacy_base else None
    blueprint_map = {item.key: item for item in allowed_items}
    items_payload: List[Dict[str, object]] = []
    modules_present: Dict[str, Dict[str, object]] = {}
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
        module_id = item.module
        if module_id:
            label, icon, order = MODULE_MAP.get(
                module_id,
                (module_id.title(), "module-generic", 9000),
            )
            modules_present.setdefault(module_id, {
                "id": module_id,
                "label": label,
                "icon": icon,
                "order": order,
            })
        payload_entry: Dict[str, object] = {
            "key": key,
            "label": item.label,
            "hidden": entry["hidden"],
            "position": entry["position"],
            "external": external,
            "disabled": disabled,
            "module": module_id,
            "section_order": item.section_order,
            "category": item.category,
            "icon": item.icon,
        }
        if href and not disabled:
            payload_entry["href"] = href
        if item.status:
            payload_entry["status"] = item.status.as_dict()
        items_payload.append(payload_entry)

    categories_present: Dict[Tuple[str, str], Dict[str, object]] = {}
    for entry in items_payload:
        module_id = entry.get("module")
        category_id = entry.get("category")
        if isinstance(module_id, str) and isinstance(category_id, str):
            categories_present.setdefault((module_id, category_id), _category_definition(module_id, category_id))

    modules_payload = sorted(modules_present.values(), key=lambda data: (data["order"], data["id"]))
    categories_payload = sorted(
        categories_present.values(),
        key=lambda data: (data["order"], str(data["module_id"]), str(data["id"]))
    )

    result: Dict[str, object] = {
        "v": NAV_VERSION,
        "items": items_payload,
        "modules": modules_payload,
        "categories": categories_payload,
        "layout": {
            "user": user_state.layout if user_state.has_custom else None,
            "global": global_state.layout if (expose_global and global_state.has_custom) else None,
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
    "get_user_sidebar_snapshot",
    "get_global_sidebar_snapshot",
    "mutate_user_sidebar_layout",
    "mutate_global_sidebar_layout",
    "LayoutConflict",
]


async def get_user_sidebar_snapshot(
    *,
    user_id: int,
    viewer_role: Optional[str],
    effective: Optional[EffectivePermissions],
) -> Dict[str, Any]:
    (
        _allowed_items,
        _default_layout,
        global_state,
        user_state,
        merged_layout,
    ) = await _resolve_layout_states(user_id, viewer_role, effective)
    return {
        "layout": user_state.layout if user_state.has_custom else None,
        "version": user_state.version,
        "hasCustom": user_state.has_custom,
        "merged": merged_layout,
        "navVersion": NAV_VERSION,
        "globalVersion": global_state.version,
        "globalHasCustom": global_state.has_custom,
        "etag": user_state.etag,
        "globalEtag": global_state.etag,
    }


async def get_global_sidebar_snapshot(
    *,
    viewer_role: Optional[str],
    effective: Optional[EffectivePermissions],
) -> Dict[str, Any]:
    allowed_items = allowed_blueprint(effective, viewer_role)
    global_state = await _load_global_layout_state(allowed_items)
    return {
        "layout": global_state.layout if global_state.has_custom else None,
        "version": global_state.version,
        "hasCustom": global_state.has_custom,
        "navVersion": NAV_VERSION,
        "etag": global_state.etag,
    }


async def mutate_user_sidebar_layout(
    *,
    user_id: int,
    payload: Optional[Dict],
    reset: bool,
    expected_version: Optional[int],
    allowed_items: Sequence[NavBlueprintItem],
) -> None:
    if reset or payload is None:
        await _delete_layout('user', user_id, expected_version=expected_version)
        return
    sanitized = sanitize_layout(payload, allowed_items)
    await _persist_layout('user', user_id, sanitized, expected_version=expected_version)


async def mutate_global_sidebar_layout(
    *,
    payload: Optional[Dict],
    reset: bool,
    expected_version: Optional[int],
    allowed_items: Sequence[NavBlueprintItem],
) -> None:
    if reset or payload is None:
        await _delete_layout('global', None, expected_version=expected_version)
        await delete_settings_by_prefix(GLOBAL_PREFIX)
        return
    sanitized = sanitize_layout(payload, allowed_items)
    await _persist_layout('global', None, sanitized, expected_version=expected_version)
