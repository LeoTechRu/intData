from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request, Depends
from fastapi.templating import Jinja2Templates

from core.models import UserRole, WebUser, TgUser
from core.services.telegram_user_service import TelegramUserService
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
        async with TelegramUserService() as service:
            tg_user: TgUser | None = None
            groups = []
            if current_user.telegram_accounts:
                tg_user = current_user.telegram_accounts[0]
                groups = await service.list_user_groups(tg_user.telegram_id)
            role_name = tg_user.role if tg_user else current_user.role
            context = {
                "user": tg_user,
                "current_user": current_user,
                "groups": groups,
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
