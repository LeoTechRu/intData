from __future__ import annotations

from fastapi import APIRouter, Request, Depends

from core.models import WebUser
from ..dependencies import get_current_web_user, get_effective_permissions
from ..template_env import templates

router = APIRouter()

DASHBOARD_WIDGETS = [
    {"key": "profile_card", "label": "Карточка профиля"},
    {"key": "today", "label": "Сегодня"},
    {"key": "quick_note", "label": "Быстрая заметка"},
    {"key": "focus_week", "label": "Фокус за неделю"},
    {"key": "goals", "label": "Достижения"},
    {"key": "focused_hours", "label": "Сфокусированные часы"},
    {"key": "health", "label": "Здоровье"},
    {"key": "activity", "label": "Активность по дням"},
    {"key": "energy", "label": "Сон / энергия"},
    {"key": "leader_groups", "label": "Руководите группами"},
    {"key": "member_groups", "label": "Состоите в группах"},
    {"key": "owned_projects", "label": "Ваши проекты"},
    {"key": "member_projects", "label": "Участвуете в проектах"},
    {"key": "upcoming_tasks", "label": "Предстоящие задачи"},
    {"key": "reminders", "label": "Напоминания"},
    {"key": "next_events", "label": "Ближайшие события"},
    {"key": "habits", "label": "Привычки"},
]

FAVORITE_PAGES = [
    {"path": "/", "label": "ЦУП", "permission": "app.dashboard.view"},
    {"path": "/tasks", "label": "Задачи", "permission": "app.tasks.manage"},
    {"path": "/projects", "label": "Проекты", "permission": "app.projects.manage"},
    {"path": "/notes", "label": "Заметки", "permission": "app.tasks.manage"},
    {"path": "/calendar", "label": "Календарь", "permission": "app.calendar.manage"},
    {"path": "/areas", "label": "Области", "permission": "app.areas.manage"},
    {"path": "/resources", "label": "Ресурсы", "permission": "app.projects.manage"},
    {"path": "/habits", "label": "Привычки", "permission": "app.habits.manage"},
    {"path": "/time", "label": "Время", "permission": "app.tasks.manage"},
    {"path": "/inbox", "label": "Входящие", "permission": "app.tasks.manage"},
    {"path": "/#cup-admin-tools", "label": "Админ", "role": "admin"},
]

THEME_PRESETS = [
    {
        "id": "aurora",
        "label": "Aurora",
        "mode": "light",
        "primary": "#2563eb",
        "accent": "#a855f7",
        "gradient": {"from": "#6366f1", "to": "#8b5cf6"},
    },
    {
        "id": "sunrise",
        "label": "Sunrise",
        "mode": "light",
        "primary": "#f97316",
        "accent": "#fb7185",
        "gradient": {"from": "#facc15", "to": "#f97316"},
    },
    {
        "id": "noir",
        "label": "Noir",
        "mode": "dark",
        "primary": "#0ea5e9",
        "accent": "#6366f1",
        "surface": "#111827",
        "gradient": {"from": "#0f172a", "to": "#1f2937"},
    },
    {
        "id": "forest",
        "label": "Forest",
        "mode": "system",
        "primary": "#16a34a",
        "accent": "#22d3ee",
        "gradient": {"from": "#134e4a", "to": "#0f766e"},
    },
]


@router.get("/settings", include_in_schema=False)
async def settings_page(
    request: Request,
    current_user: WebUser = Depends(get_current_web_user),
):
    if current_user and current_user.role in {"ban", "suspended"}:
        from fastapi.responses import RedirectResponse
        from fastapi import status
        return RedirectResponse(
            "/ban", status_code=status.HTTP_307_TEMPORARY_REDIRECT
        )
    effective = await get_effective_permissions(request, current_user=current_user)

    def _page_allowed(page: dict) -> bool:
        if effective is None:
            return False
        if "role" in page:
            return effective.has_role(page["role"])
        if "permission" in page:
            return effective.has(page["permission"])
        return True

    favorite_pages = [p for p in FAVORITE_PAGES if _page_allowed(p)]
    context = {
        "user": current_user,
        "role_name": current_user.role,
        "is_admin": bool(effective and effective.has_role("admin")),
        "page_title": "Настройки",
        "dashboard_widgets": DASHBOARD_WIDGETS,
        "favorite_pages": favorite_pages,
        "theme_presets": THEME_PRESETS,
    }
    return templates.TemplateResponse(request, "settings.html", context)
