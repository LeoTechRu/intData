"""Web application package for FastAPI endpoints."""
from pathlib import Path
from urllib.parse import quote
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request, APIRouter
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .routes import (
    admin,
    admin_settings,
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
    areas,
    projects,
    resources,
    inbox,
)
from .routes.api import admin as api_admin
from .routes.api import admin_settings as api_admin_settings
from .routes.api import auth_webapp as api_auth_webapp
from .routes.api import user_favorites as api_user_favorites
from .routes.api import app_settings as api_app_settings
from core.db import engine, init_models
from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService
from core.models import LogLevel
from core.services.notification_service import (
    run_reminder_dispatcher,
    is_scheduler_enabled,
)


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Lifespan startup: begin")
    stop_event = None
    task = None
    try:
        await init_models()
        logger.info("Lifespan startup: init_models() completed")

        password = None
        async with WebUserService() as wsvc:
            password = await wsvc.ensure_test_user()
        if password:
            async with TelegramUserService() as tsvc:
                await tsvc.send_log_to_telegram(
                    LogLevel.INFO,
                    f"test user created:\nusername: test\npassword: {password}",
                )

        # Запускаем фоновый диспетчер напоминаний при включённом флаге
        if is_scheduler_enabled():
            import asyncio

            stop_event = asyncio.Event()
            task = asyncio.create_task(
                run_reminder_dispatcher(poll_interval=60.0, stop_event=stop_event)
            )

        yield
        logger.info("Lifespan startup: completed")
    except Exception:
        logger.exception("Lifespan startup failed with exception")
        raise
    finally:
        if stop_event:
            stop_event.set()
        if task:
            try:
                await task
            except Exception:
                logger.exception("Reminder dispatcher task raised during shutdown")
        try:
            await engine.dispose()
            logger.info("Lifespan shutdown: engine disposed")
        except Exception:
            logger.exception("Lifespan shutdown raised")


tags_metadata = [
    {"name": "tasks", "description": "Task management API"},
    {"name": "reminders", "description": "Reminders scheduling API"},
    {"name": "calendar", "description": "Calendar events API"},
    {"name": "notes", "description": "Notes CRUD API"},
    {"name": "time", "description": "Time tracking API"},
    {"name": "areas", "description": "PARA Areas API"},
    {"name": "projects", "description": "PARA Projects API"},
    {"name": "resources", "description": "PARA Resources API"},
    {"name": "inbox", "description": "Inbox API"},
    {"name": "admin", "description": "Admin operations (requires admin role)"},
]

app = FastAPI(
    lifespan=lifespan,
    title="LeonidPro API",
    docs_url="/api",                 # Swagger UI -> /api
    redoc_url=None,                   # ReDoc off for now
    openapi_url="/api/openapi.json", # Spec -> /api/openapi.json
    openapi_tags=tags_metadata,
)
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

    if path.startswith("/api/v1/app-settings"):
        return await call_next(request)

    # Allow direct access to API calls using explicit authorization headers
    # Но при этом соблюдаем блокировку для забаненных пользователей
    auth = request.headers.get("Authorization")
    if auth:
        try:
            scheme, token = auth.split(" ", 1)
            if scheme.lower() == "bearer" and token.isdigit() and path != "/auth/logout":
                async with WebUserService() as wsvc:
                    u = await wsvc.get_by_id(int(token))
                if u and getattr(u, "role", None) == "ban":
                    return RedirectResponse("/ban", status_code=307)
        except Exception:
            # Fail-open для нестандартных токенов
            pass
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

    # Allow public API docs endpoints only: /api and /api/openapi.json
    if path == "/api" or path == "/api/openapi.json" or path == "/api/auth/tg-webapp/exchange":
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
app.include_router(tasks.ui_router)
app.include_router(reminders.router)
app.include_router(reminders.ui_router)
app.include_router(notes.router)
app.include_router(notes.ui_router)
app.include_router(areas.router)
app.include_router(areas.ui_router)
app.include_router(projects.router)
app.include_router(projects.ui_router)
app.include_router(resources.router)
app.include_router(resources.ui_router)
app.include_router(inbox.router)
app.include_router(inbox.ui_router)
app.include_router(calendar.router)
app.include_router(calendar.ui_router)
app.include_router(time_entries.router)
app.include_router(time_entries.ui_router)
app.include_router(auth.router)
app.include_router(admin.router, prefix="/admin")
app.include_router(admin_settings.router)

# Domain API routers
app.include_router(api_admin.router)
app.include_router(api_admin_settings.router)
app.include_router(api_auth_webapp.router)
app.include_router(api_user_favorites.router)
app.include_router(api_app_settings.router)

# Root API aggregator (prefix /api). Domain routers below already serve under /api/*
# so we don't add nested prefixes here to avoid double /api.
api = APIRouter(prefix="/api")
app.include_router(api)
