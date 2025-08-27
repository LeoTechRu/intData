"""Web application package for FastAPI endpoints."""
from pathlib import Path
from urllib.parse import quote
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .routes import (
    admin,
    auth,
    index,
    profile,
    settings,
    habits,
    tasks,
    reminders,
    notes,
    calendar,
    time_entries,
)
from core.db import init_models
from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService
from core.models import LogLevel


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_models()
    password = None
    async with WebUserService() as wsvc:
        password = await wsvc.ensure_test_user()
    if password:
        async with TelegramUserService() as tsvc:
            await tsvc.send_log_to_telegram(
                LogLevel.INFO,
                f"test user created:\nusername: test\npassword: {password}",
            )
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

    # Always allow the ban page itself
    if path == "/ban":
        return await call_next(request)

    # Allow direct access to API calls using explicit authorization headers
    if request.headers.get("Authorization"):
        return await call_next(request)

    web_user_id = request.cookies.get("web_user_id")
    telegram_id = request.cookies.get("telegram_id")

    # Redirect banned users to /ban (but allow logout)
    try:
        if web_user_id and path != "/auth/logout":
            async with WebUserService() as wsvc:
                user = await wsvc.get_by_id(int(web_user_id))
            if user and getattr(user, "role", None) == "ban":
                return RedirectResponse("/ban", status_code=307)
        if not web_user_id and telegram_id and path != "/auth/logout":
            async with TelegramUserService() as tsvc:
                tg_user = await tsvc.get_user_by_telegram_id(int(telegram_id))
            if tg_user and getattr(tg_user, "role", None) == "ban":
                return RedirectResponse("/ban", status_code=307)
    except Exception:
        # Fail-open to avoid blocking on middleware errors
        pass

    # Authentication routes
    if path.startswith("/auth"):
        if web_user_id and path == "/auth":
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
    return RedirectResponse(f"/auth?next={quote(next_url, safe='')}")


app.include_router(index.router)
app.include_router(profile.router)
app.include_router(settings.router)
app.include_router(habits.router)
app.include_router(tasks.router)
app.include_router(reminders.router)
app.include_router(notes.router)
app.include_router(calendar.router)
app.include_router(time_entries.router)
app.include_router(auth.router)
app.include_router(admin.router, prefix="/admin")

