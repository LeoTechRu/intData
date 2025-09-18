from fastapi import APIRouter, Response
from fastapi.responses import HTMLResponse, RedirectResponse

from .index import render_next_page

ui_router = APIRouter(include_in_schema=False, tags=["pricing"])


@ui_router.get("/pricing", include_in_schema=False)
@ui_router.get("/pricing/", include_in_schema=False)
@ui_router.head("/pricing", include_in_schema=False)
@ui_router.head("/pricing/", include_in_schema=False)
async def pricing_redirect() -> RedirectResponse:
    """Permanent redirect to the public tariffs landing."""
    return RedirectResponse(url="/tariffs", status_code=308)


@ui_router.get("/tariffs", response_class=HTMLResponse)
@ui_router.get("/tariffs/", response_class=HTMLResponse)
async def tariffs_page() -> HTMLResponse:
    """Alias for legacy /tariffs link."""
    return render_next_page("tariffs")


@ui_router.head("/tariffs", include_in_schema=False)
@ui_router.head("/tariffs/", include_in_schema=False)
async def tariffs_head() -> Response:
    """Return headers identical to GET /tariffs without rendering the body."""
    html_response = render_next_page("tariffs")
    return Response(status_code=200, headers=dict(html_response.headers))
