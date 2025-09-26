from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse

from backend.models import WebUser
from backend.services.web_user_service import WebUserService
from backend.services.telegram_user_service import TelegramUserService
from backend.services.group_moderation_service import GroupModerationService
from backend.services.access_control import AccessControlService
from ..dependencies import role_required
from .index import render_next_page

router = APIRouter(prefix="/cup", tags=["cup"], include_in_schema=False)
admin_ui_router = APIRouter(prefix="/admin", tags=["admin"], include_in_schema=False)


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
    async with AccessControlService() as access:
        roles = await access.list_roles()
        admin_roles = [role.slug for role in roles]
    return {
        "admin_users_tg": users_tg,
        "admin_users_web": users_web,
        "admin_groups": groups_with_members,
        "admin_roles": admin_roles,
        "admin_group_moderation": admin_group_moderation,
    }


@router.get("/admin-embed", name="cup:admin-embed", response_class=HTMLResponse)
async def admin_embed(
    current_user: WebUser = Depends(role_required("admin")),
):
    """Serve the admin console embed via Next.js."""

    # При обращении к странице выполняем ту же проверку прав,
    # что и для API-хендлеров — данные загружаются клиентом.
    return render_next_page("cup/admin-embed")


@admin_ui_router.get("", name="admin:dashboard")
async def admin_dashboard_page(current_user: WebUser = Depends(role_required("admin"))):
    """Serve the modern admin dashboard implemented in Next.js."""
    return render_next_page("admin")


"""Admin UI routes only. JSON actions live under /api/v1/admin/*."""
