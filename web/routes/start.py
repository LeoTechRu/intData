from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates

from core.models import UserRole
from core.services.telegram import UserService

router = APIRouter()

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))


@router.get("/start", include_in_schema=False)
async def start_dashboard(request: Request):
    telegram_id = request.cookies.get("telegram_id")
    if not telegram_id:
        return RedirectResponse("/auth/login")
    try:
        user_id = int(telegram_id)
    except ValueError:
        return RedirectResponse("/auth/login")

    async with UserService() as service:
        user = await service.get_user_by_telegram_id(user_id)
        if user is None:
            return RedirectResponse("/auth/login")
        groups = await service.list_user_groups(user_id)

    context = {
        "request": request,
        "user": user,
        "groups": groups,
        "role_name": UserRole(user.role).name,
        "is_admin": user.role >= UserRole.admin.value,
    }
    return templates.TemplateResponse("start.html", context)
