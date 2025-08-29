"""Web application package for FastAPI endpoints."""
from pathlib import Path
from urllib.parse import quote
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html, get_swagger_ui_oauth2_redirect_html

from .routes import (
    admin as admin_ui,
    admin_settings as admin_settings_ui,
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
    api_router,
    API_PREFIX,
)
from core.db import engine, init_models
from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService
from core.models import LogLevel
from core.services.notification_service import (
    run_reminder_dispatcher,
    is_scheduler_enabled,
)
from . import para_schemas  # noqa: F401


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
    {"name": "app-settings", "description": "Application settings API"},
    {"name": "auth", "description": "Authentication API"},
    {"name": "user", "description": "User favorites API"},
]

app = FastAPI(
    lifespan=lifespan,
    title="LeonidPro API",
    docs_url=None,
    redoc_url=None,
    openapi_url="/api/openapi.json",
    openapi_tags=tags_metadata,
    redirect_slashes=False,
    servers=[{"url": API_PREFIX}],
)
STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

FAVICON_PATH = STATIC_DIR / "img" / "brand" / "leonidpro-favicon.svg"


@app.get("/favicon.ico", include_in_schema=False)
async def favicon() -> FileResponse:
    """Serve application favicon."""
    return FileResponse(FAVICON_PATH, media_type="image/svg+xml")


@app.get("/api", include_in_schema=False)
async def swagger_ui():
    return get_swagger_ui_html(
        openapi_url="/api/openapi.json", title="LeonidPro API - Swagger UI"
    )


@app.get("/api/swagger-ui/oauth2-redirect", include_in_schema=False)
async def swagger_redirect():
    return get_swagger_ui_oauth2_redirect_html()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

    # Allow public API docs endpoints
    if (
        path == "/api"
        or path.startswith("/api/swagger-ui")
        or path == "/api/openapi.json"
        or path == "/api/v1/auth/tg-webapp/exchange"
    ):
        return await call_next(request)

    # Allow other API paths to return their own status codes
    if path.startswith("/api/"):
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


app.include_router(index.router, include_in_schema=False)
app.include_router(profile.router, include_in_schema=False)
app.include_router(settings.router, include_in_schema=False)
app.include_router(habits.router, include_in_schema=False)
app.include_router(tasks.ui_router, include_in_schema=False)
app.include_router(reminders.ui_router, include_in_schema=False)
app.include_router(notes.ui_router, include_in_schema=False)
app.include_router(areas.ui_router, include_in_schema=False)
app.include_router(projects.ui_router, include_in_schema=False)
app.include_router(resources.ui_router, include_in_schema=False)
app.include_router(inbox.ui_router, include_in_schema=False)
app.include_router(calendar.ui_router, include_in_schema=False)
app.include_router(time_entries.ui_router, include_in_schema=False)
app.include_router(auth.router, include_in_schema=False)
app.include_router(admin_ui.router, prefix="/admin", include_in_schema=False)
app.include_router(admin_settings_ui.router, include_in_schema=False)

# Подключение всех API под единым префиксом
app.include_router(api_router, prefix=API_PREFIX)
