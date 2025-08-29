from __future__ import annotations

from fastapi import APIRouter, Request, Depends

from core.models import WebUser
from ..dependencies import get_current_web_user
from ..template_env import templates

router = APIRouter()


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
    context = {
        "user": current_user,
        "role_name": current_user.role,
        "is_admin": current_user.role == "admin",
        "page_title": "Настройки",
    }
    return templates.TemplateResponse(request, "settings.html", context)
