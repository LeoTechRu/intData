from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request, Depends
from fastapi.templating import Jinja2Templates

from core.models import User, UserRole
from ..dependencies import get_current_user

router = APIRouter()

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))


@router.get("/settings", include_in_schema=False)
async def settings_page(request: Request, current_user: User = Depends(get_current_user)):
    context = {
        "request": request,
        "user": current_user,
        "role_name": UserRole(current_user.role).name,
        "is_admin": current_user.is_admin,
        "page_title": "Настройки",
    }
    return templates.TemplateResponse("settings.html", context)
