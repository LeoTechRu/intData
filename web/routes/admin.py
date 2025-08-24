from fastapi import APIRouter, Depends, Request
from fastapi.templating import Jinja2Templates
from core.models import WebUser, UserRole
from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService
from ..dependencies import role_required


templates = Jinja2Templates(directory="web/templates")
router = APIRouter()


@router.get("")
async def admin_dashboard(
    request: Request, current_user: WebUser = Depends(role_required(UserRole.admin))
):
    """Render consolidated admin landing page with users and groups."""
    async with TelegramUserService() as tsvc, WebUserService() as wsvc:
        tg_users = await tsvc.list_users()
        groups_with_members = await tsvc.list_groups_with_members()
        web_users = await wsvc.list_users()

    context = {
        "tg_users": tg_users,
        "web_users": web_users,
        "groups": groups_with_members,
        "user": current_user,
        "role_name": current_user.role,
        "is_admin": True,
        "page_title": "Админ",
    }
    return templates.TemplateResponse(request, "admin/index.html", context)


@router.post("/role/{telegram_id}")
async def change_user_role(
    telegram_id: int,
    role: UserRole,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    """Change the role of a user.

    Using a simple query/body parameter avoids the ``python-multipart``
    dependency which keeps tests lightweight.
    """
    async with TelegramUserService() as service:
        await service.update_user_role(telegram_id, role)
    return {"status": "ok"}
