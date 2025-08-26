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


@router.post("/role/{telegram_id}")
async def change_user_role(
    telegram_id: int,
    role: str,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    """Change the role of a telegram user."""
    async with TelegramUserService() as service:
        await service.update_user_role(telegram_id, UserRole[role])
    return {"status": "ok"}


@router.post("/web/role/{user_id}")
async def change_web_user_role(
    user_id: int,
    role: str,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    async with WebUserService() as service:
        await service.update_user_role(user_id, UserRole[role])
    return {"status": "ok"}


@router.post("/web/link")
async def link_web_user(
    web_user_id: int,
    tg_user_id: int,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    async with WebUserService() as service:
        await service.link_telegram(web_user_id, tg_user_id)
    return {"status": "ok"}


@router.post("/web/unlink")
async def unlink_web_user(
    web_user_id: int,
    tg_user_id: int,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    async with WebUserService() as service:
        await service.unlink_telegram(web_user_id, tg_user_id)
    return {"status": "ok"}
