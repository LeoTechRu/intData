from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request, Depends
from fastapi.templating import Jinja2Templates

from core.models import UserRole, WebUser, TgUser
from core.services.telegram_user_service import TelegramUserService
from core.services.nexus_service import ProjectService
from web.dependencies import get_current_web_user
from web.config import S

router = APIRouter()


TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))


@router.get("/", include_in_schema=False)
async def index(
    request: Request, current_user: WebUser | None = Depends(get_current_web_user)
):
    """Render dashboard for authorised users or login page for guests."""
    if current_user:
        async with TelegramUserService() as service, ProjectService() as project_service:
            tg_user: TgUser | None = None
            owned_groups = []
            member_groups = []
            owned_projects = []
            member_projects = []
            if current_user.telegram_accounts:
                tg_user = current_user.telegram_accounts[0]
                all_groups = await service.list_user_groups(tg_user.telegram_id)
                owned_groups = [g for g in all_groups if g.owner_id == tg_user.telegram_id]
                member_groups = [g for g in all_groups if g.owner_id != tg_user.telegram_id]
                owned_projects = await project_service.list(owner_id=tg_user.telegram_id)
            role_name = tg_user.role if tg_user else current_user.role
            context = {
                "user": tg_user,
                "current_user": current_user,
                "profile_user": current_user,
                "owned_groups": owned_groups,
                "member_groups": member_groups,
                "owned_projects": owned_projects,
                "member_projects": member_projects,
                "role_name": role_name,
                "current_role_name": current_user.role,
                "is_admin": UserRole[role_name] >= UserRole.admin,
                "page_title": "Дашборд",
            }
            return templates.TemplateResponse(request, "start.html", context)

    bot_user = S.TELEGRAM_BOT_USERNAME
    return templates.TemplateResponse(
        request,
        "auth/login.html",
        {
            "bot_username": bot_user,
            "telegram_id": request.cookies.get("telegram_id"),
            "page_title": "Вход",
        },
    )
