from fastapi import APIRouter, Depends, Request

from core.models import WebUser, UserRole
from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService
from ..dependencies import role_required
from ..template_env import templates

router = APIRouter()


@router.get("")
async def admin_dashboard(
    request: Request,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    """Render consolidated admin landing page with users and groups."""
    async with TelegramUserService() as tsvc, WebUserService() as wsvc:
        users_tg = await tsvc.list_users()
        groups_with_members = await tsvc.list_groups_with_members()
        users_web = await wsvc.list_users()

    context = {
        "users_tg": users_tg,
        "users_web": users_web,
        "groups": groups_with_members,
        "roles": [r.name for r in UserRole],
        "user": current_user,
        "role_name": current_user.role,
        "is_admin": True,
        "page_title": "Админ",
    }
    return templates.TemplateResponse(request, "admin/index.html", context)


"""Admin UI routes only. JSON actions moved to /api/admin/*."""
