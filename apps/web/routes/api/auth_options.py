from __future__ import annotations

from fastapi import APIRouter, Request

from web.routes.auth import get_auth_public_options

router = APIRouter(prefix="/auth", tags=["Users"])


@router.get("/options", name="api:auth_options")
async def auth_options(request: Request) -> dict[str, object]:
    """Expose public configuration for the auth landing page."""

    return get_auth_public_options(request)
