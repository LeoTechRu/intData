from fastapi import APIRouter, Depends, Request
from fastapi.templating import Jinja2Templates
from core.models import User, UserRole
from core.services.telegram import UserService
from ..dependencies import role_required


templates = Jinja2Templates(directory="web/templates")
router = APIRouter()


@router.get("/users")
async def list_users(request: Request, current_user: User = Depends(role_required(UserRole.admin))):
    """Render a page with all registered users."""
    async with UserService() as service:
        users = await service.list_users()
    context = {
        "request": request,
        "users": users,
        "UserRole": UserRole,
        "user": current_user,
        "role_name": UserRole(current_user.role).name,
        "is_admin": True,
        "page_title": "Админ: Пользователи",
    }
    return templates.TemplateResponse("admin/users.html", context)


@router.post("/users/{telegram_id}/role")
async def change_user_role(telegram_id: int, role: UserRole, current_user: User = Depends(role_required(UserRole.admin))):
    """Change the role of a user.

    Using a simple query/body parameter avoids the ``python-multipart``
    dependency which keeps tests lightweight.
    """
    async with UserService() as service:
        await service.update_user_role(telegram_id, role)
    return {"status": "ok"}


@router.get("/groups")
async def list_groups(request: Request, current_user: User = Depends(role_required(UserRole.admin))):
    """Render a page with all groups and their members."""
    async with UserService() as service:
        groups_with_members = await service.list_groups_with_members()
    context = {
        "request": request,
        "groups": groups_with_members,
        "user": current_user,
        "role_name": UserRole(current_user.role).name,
        "is_admin": True,
        "page_title": "Админ: Группы",
    }
    return templates.TemplateResponse("admin/groups.html", context)


@router.get("/settings")
async def admin_settings(request: Request, current_user: User = Depends(role_required(UserRole.admin))):
    """Placeholder for admin settings page."""
    context = {
        "request": request,
        "user": current_user,
        "role_name": UserRole(current_user.role).name,
        "is_admin": True,
        "page_title": "Админ: Настройки",
    }
    return templates.TemplateResponse("admin/settings.html", context)
