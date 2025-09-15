from typing import Any

from fastapi import APIRouter, Depends, Request

from core.models import WebUser, UserRole
from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService
from ..dependencies import role_required
from ..template_env import templates

router = APIRouter()


async def load_admin_console_data() -> dict[str, Any]:
    """Collect datasets required for the admin console UI."""
    async with TelegramUserService() as tsvc, WebUserService() as wsvc:
        users_tg = await tsvc.list_users()
        groups_with_members = await tsvc.list_groups_with_members()
        users_web = await wsvc.list_users()
    return {
        "admin_users_tg": users_tg,
        "admin_users_web": users_web,
        "admin_groups": groups_with_members,
        "admin_roles": [r.name for r in UserRole],
    }


@router.get("")
async def admin_dashboard(
    request: Request,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    """Render consolidated admin landing page with users and groups."""
    admin_data = await load_admin_console_data()

    context = {
        **admin_data,
        "user": current_user,
        "role_name": current_user.role,
        "is_admin": True,
        "page_title": "Админ",
        "page_title_tooltip": "Административные инструменты",
        "admin_heading_description": "Полный набор сервисов для управления платформой.",
    }
    return templates.TemplateResponse(request, "admin/index.html", context)


"""Admin UI routes only. JSON actions moved to /api/v1/admin/*."""
