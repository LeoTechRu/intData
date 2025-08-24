from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request, Depends
from fastapi.templating import Jinja2Templates

from core.models import WebUser
from ..dependencies import get_current_web_user

router = APIRouter()

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))


@router.get("/settings", include_in_schema=False)
async def settings_page(request: Request, current_user: WebUser = Depends(get_current_web_user)):
    context = {
        "user": current_user,
        "role_name": current_user.role,
        "is_admin": current_user.role == "admin",
        "page_title": "Настройки",
    }
    return templates.TemplateResponse(request, "settings.html", context)
