from __future__ import annotations

from pathlib import Path
from functools import lru_cache

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse


router = APIRouter(include_in_schema=False)


@lru_cache(maxsize=None)
def _load_next_page(name: str) -> str:
    root = Path(__file__).resolve().parents[1] / ".next" / "server" / "app"
    path = root / f"{name}.html"
    if not path.exists():
        raise HTTPException(status_code=500, detail=f"Next.js page '{name}' не собран")
    return path.read_text(encoding="utf-8")


@router.get("/users", response_class=HTMLResponse)
@router.get("/users/", response_class=HTMLResponse)
async def users_catalog_page() -> HTMLResponse:
    return HTMLResponse(_load_next_page("users"))


@router.get("/users/{slug}", response_class=HTMLResponse)
@router.get("/users/{slug}/", response_class=HTMLResponse)
async def user_profile_page(slug: str) -> HTMLResponse:  # noqa: ARG001 - slug used on client
    return HTMLResponse(_load_next_page("users"))
