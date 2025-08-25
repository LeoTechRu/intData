"""Web application package for FastAPI endpoints."""
from pathlib import Path
from urllib.parse import quote
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .routes import admin, auth, index, profile, settings
from core.db import init_models


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_models()
    yield


app = FastAPI(lifespan=lifespan)
STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Simple auth middleware using cookies for web users."""
    path = request.url.path

    # Allow serving static resources and favicons without auth
    if path.startswith("/static") or path.startswith("/favicon"):
        return await call_next(request)

    # Allow direct access to API calls using explicit authorization headers
    if request.headers.get("Authorization"):
        return await call_next(request)

    web_user_id = request.cookies.get("web_user_id")
    telegram_id = request.cookies.get("telegram_id")

    # Authentication routes
    if path.startswith("/auth"):
        if web_user_id and path == "/auth/login":
            return RedirectResponse("/")
        return await call_next(request)

    # Skip docs and schema endpoints
    if path.startswith("/docs") or path.startswith("/openapi"):
        return await call_next(request)

    # Allow root path for both authenticated and guest users
    if path == "/":
        return await call_next(request)

    # Authenticated users can access other routes directly
    if web_user_id or telegram_id:
        return await call_next(request)

    # For everything else require login, preserving original destination
    next_url = request.url.path
    if request.url.query:
        next_url += "?" + request.url.query
    return RedirectResponse(f"/auth/login?next={quote(next_url, safe='')}")


app.include_router(index.router)
app.include_router(profile.router)
app.include_router(settings.router)
app.include_router(auth.router, prefix="/auth")
app.include_router(admin.router, prefix="/admin")
