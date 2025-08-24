from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates

from core.models import UserRole
from core.services.telegram import UserService
from web.config import S

router = APIRouter()


TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))


@router.get("/", include_in_schema=False)
async def index(request: Request):
    """Dashboard for authenticated users or login for guests."""
    telegram_id = request.cookies.get("telegram_id")

    if telegram_id:
        try:
            user_id = int(telegram_id)
        except ValueError:
            user_id = None
        if user_id is not None:
            async with UserService() as service:
                user = await service.get_user_by_telegram_id(user_id)
                if user:
                    groups = await service.list_user_groups(user_id)
                    context = {
                        "request": request,
                        "user": user,
                        "groups": groups,
                        "role_name": UserRole(user.role).name,
                        "is_admin": user.is_admin,
                    }
                    return templates.TemplateResponse("start.html", context)

    bot_user = S.TELEGRAM_BOT_USERNAME
    return templates.TemplateResponse(
        "auth/login.html",
        {"request": request, "bot_username": bot_user, "next_query": ""},
    )

@router.get("/admin", include_in_schema=False)
async def admin_index():
    return RedirectResponse("/admin/users")
