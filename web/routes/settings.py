from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

router = APIRouter()

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

@router.get("/settings", include_in_schema=False)
async def settings_page(request: Request):
    return templates.TemplateResponse(request, "settings.html", {})
