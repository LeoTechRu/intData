from fastapi import APIRouter, Depends, Request
from fastapi.templating import Jinja2Templates
from core.models import User, UserRole
from core.services.telegram import UserService
from ..dependencies import role_required


templates = Jinja2Templates(directory="web/templates")
router = APIRouter()


@router.get("")
async def admin_dashboard(
    request: Request, current_user: User = Depends(role_required(UserRole.admin))
):
    """Render consolidated admin landing page with users and groups."""
    async with UserService() as service:
        users = await service.list_users()
        groups_with_members = await service.list_groups_with_members()

    context = {
        "request": request,
        "users": users,
        "groups": groups_with_members,
        "UserRole": UserRole,
        "user": current_user,
        "role_name": UserRole(current_user.role).name,
        "is_admin": True,
        "page_title": "Админ",
    }
    return templates.TemplateResponse("admin/index.html", context)


@router.post("/role/{telegram_id}")
async def change_user_role(
    telegram_id: int,
    role: UserRole,
    current_user: User = Depends(role_required(UserRole.admin)),
):
    """Change the role of a user.

    Using a simple query/body parameter avoids the ``python-multipart``
    dependency which keeps tests lightweight.
    """
    async with UserService() as service:
        await service.update_user_role(telegram_id, role)
    return {"status": "ok"}
