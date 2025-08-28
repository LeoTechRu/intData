from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse

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


@router.post("/role/{telegram_id}", include_in_schema=False)
async def change_user_role(
    telegram_id: int,
    role: str,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    """Deprecated: redirect to /api/admin/role/{telegram_id}."""
    return RedirectResponse(
        url=f"/api/admin/role/{telegram_id}?role={role}",
        status_code=307,
        headers={"Deprecation": "true"},
    )


@router.post("/web/role/{user_id}", include_in_schema=False)
async def change_web_user_role(
    user_id: int,
    role: str,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    return RedirectResponse(
        url=f"/api/admin/web/role/{user_id}?role={role}",
        status_code=307,
        headers={"Deprecation": "true"},
    )


@router.post("/web/link", include_in_schema=False)
async def link_web_user(
    web_user_id: int,
    tg_user_id: int,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    return RedirectResponse(
        url=f"/api/admin/web/link?web_user_id={web_user_id}&tg_user_id={tg_user_id}",
        status_code=307,
        headers={"Deprecation": "true"},
    )


@router.post("/web/unlink", include_in_schema=False)
async def unlink_web_user(
    web_user_id: int,
    tg_user_id: int,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    return RedirectResponse(
        url=f"/api/admin/web/unlink?web_user_id={web_user_id}&tg_user_id={tg_user_id}",
        status_code=307,
        headers={"Deprecation": "true"},
    )
