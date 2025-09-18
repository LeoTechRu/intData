from fastapi import APIRouter, Response
from fastapi.responses import HTMLResponse

from .index import render_next_page

ui_router = APIRouter(include_in_schema=False, tags=["docs"])


@ui_router.get("/docs", response_class=HTMLResponse)
@ui_router.get("/docs/", response_class=HTMLResponse)
async def docs_page() -> HTMLResponse:
    """Публичная документация без авторизации."""
    return render_next_page("docs")


@ui_router.head("/docs", include_in_schema=False)
@ui_router.head("/docs/", include_in_schema=False)
async def docs_head() -> Response:
    """Возвращает только заголовки для health-check."""
    html_response = render_next_page("docs")
    return Response(status_code=200, headers=dict(html_response.headers))
