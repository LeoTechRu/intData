from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse

from core.models import WebUser, UserRole
from web.dependencies import get_current_web_user
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
async def settings_page(
    current_user: Optional[WebUser] = Depends(get_current_web_user),
) -> HTMLResponse:
    """Serve the Next.js settings page."""

    response = render_next_page("settings")
    role = getattr(current_user, "role", None)
    is_admin = role == UserRole.admin.name if role else False
    role_marker = "admin" if is_admin else "user"
    marker_html = (
        f'<span data-testid="settings-admin-marker" data-role="{role_marker}" '
        f'class="hidden" aria-hidden="true"></span>'
        f'<span data-testid="settings-theme-scope" data-global="{str(is_admin).lower()}" '
        'class="hidden" aria-hidden="true"></span>'
    )

    body = response.body.decode("utf-8")
    body = body.replace("</body>", marker_html + "</body>")
    return HTMLResponse(
        body,
        status_code=response.status_code,
        headers=dict(response.headers),
        media_type=response.media_type,
    )
