from typing import Any

from fastapi import APIRouter, Depends, Request

from core.models import WebUser, UserRole
from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService
from core.services.group_moderation_service import GroupModerationService
from ..dependencies import role_required
from ..template_env import templates

router = APIRouter()


async def load_admin_console_data() -> dict[str, Any]:
    """Collect datasets required for the admin console UI."""
    async with TelegramUserService() as tsvc, WebUserService() as wsvc:
        users_tg = await tsvc.list_users()
        groups_with_members = await tsvc.list_groups_with_members()
        users_web = await wsvc.list_users()
        moderation_service = GroupModerationService(tsvc.session)
        moderation_raw = await moderation_service.groups_overview(limit=8)
        admin_group_moderation = [
            {
                "group": item["group"],
                "members": item.get("members_total", 0),
                "active": item.get("active_members", 0),
                "quiet": item.get("quiet_members", 0),
                "unpaid": item.get("unpaid_members", 0),
                "last_activity": item.get("last_activity"),
            }
            for item in moderation_raw
        ]
    return {
        "admin_users_tg": users_tg,
        "admin_users_web": users_web,
        "admin_groups": groups_with_members,
        "admin_roles": [r.name for r in UserRole],
        "admin_group_moderation": admin_group_moderation,
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
