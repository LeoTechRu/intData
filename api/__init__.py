"""Aggregate API routers under /api/v1 prefix."""
from fastapi import APIRouter

from web.routes.api import (
    admin,
    admin_settings,
    app_settings,
    auth_webapp,
    user_favorites,
)


api_v1 = APIRouter(prefix="/api/v1")

# Attach domain routers without additional prefixes.
api_v1.include_router(admin.router)
api_v1.include_router(admin_settings.router)
api_v1.include_router(app_settings.router)
api_v1.include_router(auth_webapp.router)
api_v1.include_router(user_favorites.router)

__all__ = ["api_v1"]

