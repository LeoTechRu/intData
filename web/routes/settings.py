from __future__ import annotations

from fastapi import APIRouter, Request, Depends

from core.models import WebUser, UserRole
from ..dependencies import get_current_web_user
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
    {"path": "/", "label": "Дашборд", "min_role": UserRole.single},
    {"path": "/tasks", "label": "Задачи", "min_role": UserRole.single},
    {"path": "/projects", "label": "Проекты", "min_role": UserRole.single},
    {"path": "/notes", "label": "Заметки", "min_role": UserRole.single},
    {"path": "/calendar", "label": "Календарь", "min_role": UserRole.single},
    {"path": "/areas", "label": "Области", "min_role": UserRole.single},
    {"path": "/resources", "label": "Ресурсы", "min_role": UserRole.single},
    {"path": "/habits", "label": "Привычки", "min_role": UserRole.single},
    {"path": "/admin", "label": "Админ", "min_role": UserRole.admin},
]


@router.get("/settings", include_in_schema=False)
async def settings_page(
    request: Request,
    current_user: WebUser = Depends(get_current_web_user),
):
    if current_user and current_user.role == "ban":
        from fastapi.responses import RedirectResponse
        from fastapi import status
        return RedirectResponse(
            "/ban", status_code=status.HTTP_307_TEMPORARY_REDIRECT
        )
    role_enum = UserRole[current_user.role]
    favorite_pages = [
        p for p in FAVORITE_PAGES if role_enum >= p["min_role"]
    ]
    context = {
        "user": current_user,
        "role_name": current_user.role,
        "is_admin": current_user.role == "admin",
        "page_title": "Настройки",
        "dashboard_widgets": DASHBOARD_WIDGETS,
        "favorite_pages": favorite_pages,
    }
    return templates.TemplateResponse(request, "settings.html", context)

