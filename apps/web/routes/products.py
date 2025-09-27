from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from .index import render_next_page

# Легаси-UI перенесён в Next.js (web/app/products/*).
# API для продуктов формируется через /api/v1/profiles/products (см. web/routes/api_profiles.py).
# Здесь оставляем заглушку на случай будущих хендлеров, чтобы include_router не ломал импорт.

api = APIRouter(prefix="/products", tags=["products"])

ui_router = APIRouter(prefix="/products", tags=["products"], include_in_schema=False)


@ui_router.get("", include_in_schema=False, response_class=HTMLResponse)
@ui_router.get("/", include_in_schema=False, response_class=HTMLResponse)
async def products_catalog_page() -> HTMLResponse:
    """Serve the Next.js products catalog."""

    return render_next_page("products")


@ui_router.get("/{slug}", include_in_schema=False, response_class=HTMLResponse)
@ui_router.get("/{slug}/", include_in_schema=False, response_class=HTMLResponse)
async def product_profile_page(slug: str) -> HTMLResponse:  # noqa: ARG001 - handled client-side
    """Serve the product profile page (Next.js dynamic route)."""

    return render_next_page("products")
