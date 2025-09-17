from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from .index import render_next_page

router = APIRouter()

FAVORITE_PAGES = [
    {"path": "/", "label": "Обзор", "permission": "app.dashboard.view"},
    {"path": "/tasks", "label": "Задачи", "permission": "app.tasks.manage"},
    {"path": "/projects", "label": "Проекты", "permission": "app.projects.manage"},
    {"path": "/notes", "label": "Заметки", "permission": "app.tasks.manage"},
    {"path": "/calendar", "label": "Календарь", "permission": "app.calendar.manage"},
    {"path": "/settings#areas", "label": "Области", "permission": "app.areas.manage"},
    {"path": "/resources", "label": "Ресурсы", "permission": "app.projects.manage"},
    {"path": "/habits", "label": "Привычки", "permission": "app.habits.manage"},
    {"path": "/time", "label": "Время", "permission": "app.tasks.manage"},
    {"path": "/inbox", "label": "Входящие", "permission": "app.tasks.manage"},
    {"path": "/admin", "label": "Админ", "role": "admin"},
]


@router.get("/settings", include_in_schema=False, response_class=HTMLResponse)
@router.get("/settings/", include_in_schema=False, response_class=HTMLResponse)
async def settings_page() -> HTMLResponse:
    """Serve the Next.js settings page."""

    return render_next_page("settings")
