from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from .index import render_next_page

router = APIRouter()


@router.get("/settings", include_in_schema=False, response_class=HTMLResponse)
@router.get("/settings/", include_in_schema=False, response_class=HTMLResponse)
async def settings_page() -> HTMLResponse:
    """Serve the Next.js settings page."""

    return render_next_page("settings")
