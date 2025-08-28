from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from core.models import WebUser, UserRole
from .dependencies import role_required
from .template_env import templates


router = APIRouter(prefix="/admin", tags=["admin"], include_in_schema=False)


@router.get("/settings")
async def admin_settings_page(
    request: Request,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    return templates.TemplateResponse(request, "admin_settings.html", {
        "current_user": current_user,
        "current_role_name": current_user.role,
        "is_admin": True,
        "page_title": "Настройки приложения",
    })

