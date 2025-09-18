from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from .index import render_next_page

ui_router = APIRouter(include_in_schema=False, tags=["pricing"])


@ui_router.get("/pricing", response_class=HTMLResponse)
@ui_router.get("/pricing/", response_class=HTMLResponse)
async def pricing_page() -> HTMLResponse:
    """Serve modern pricing landing."""
    return render_next_page("pricing")


@ui_router.get("/tariffs", response_class=HTMLResponse)
@ui_router.get("/tariffs/", response_class=HTMLResponse)
async def tariffs_page() -> HTMLResponse:
    """Alias for legacy /tariffs link."""
    return render_next_page("tariffs")
