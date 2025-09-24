"""Web application package for FastAPI endpoints."""
from pathlib import Path
from urllib.parse import quote
from contextlib import asynccontextmanager
import json
import logging
import os

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from .middleware_logging import LoggingMiddleware
from .middleware_security import (
    BodySizeLimitMiddleware,
    SecurityHeadersMiddleware,
)
from .security.csp import build_csp
from .config import S
from .middleware_rate_limit import RateLimitMiddleware
from core.tracing import setup_tracing
from .routes import system as system_routes

from .routes import (
    admin as admin_ui,
    auth,
    index,
    settings,
    habits,
    notes,
    areas,
    projects,
    tasks,
    resources,
    calendar,
    time_entries,
    products,
    pricing,
    docs_public,
    groups,
    inbox,
    api_router,
)
from core.db import engine
from core.db.engine import ENGINE_MODE
from core.db.init_app import init_app_once
from core.env import env
from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService
from core.models import LogLevel
from core.services.project_notification_worker import (
    ProjectNotificationWorker,
    is_scheduler_enabled,
)
from . import para_schemas  # noqa: F401
from core.db.schema_export import check as check_schema
from core.logging import setup_logging

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Lifespan startup: begin (ENGINE_MODE=%s)", ENGINE_MODE)
    stop_event = None
    task = None
    try:
        await init_app_once(env)
        logger.info("Lifespan startup: init_app_once() completed")

        if os.getenv("STRICT_SCHEMA", "0") == "1":
            ok = check_schema()
            if not ok:
                logger.warning(
                    "DB schema is out of date with models. Run: python -m tools.schema_export generate"
                )

        password = None
        async with WebUserService() as wsvc:
            password = await wsvc.ensure_test_user()
        if password:
            async with TelegramUserService() as tsvc:
                await tsvc.send_log_to_telegram(
                    LogLevel.INFO,
                    f"test user created:\nusername: test\npassword: {password}",
                )

        # Запускаем фоновый воркер уведомлений при включённом флаге
        if is_scheduler_enabled():
            import asyncio

            stop_event = asyncio.Event()
            worker = ProjectNotificationWorker(poll_interval=60.0)
            task = asyncio.create_task(worker.start(stop_event))

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
                logger.exception("Notification worker task raised during shutdown")
        try:
            await engine.dispose()
            logger.info("Lifespan shutdown: engine disposed")
        except Exception:
            logger.exception("Lifespan shutdown raised")


tags_metadata = [
    {
        "name": "Tasks & Projects",
        "description": "PARA planning endpoints covering tasks, projects, areas, resources, and notes.",
    },
    {
        "name": "Control Hub",
        "description": "Personal effectiveness suite: inbox, reminders, calendar, dashboard, and time tracking.",
    },
    {
        "name": "Users",
        "description": "Authentication, user preferences, and account management APIs.",
    },
    {
        "name": "Habits",
        "description": "Habitica-inspired habit, daily, reward, and stats endpoints.",
    },
    {
        "name": "Team Hub",
        "description": "Group and team collaboration tools, including Telegram group CRM.",
    },
    {"name": "admin", "description": "Admin operations (requires admin role)."},
    {"name": "app-settings", "description": "Application settings API."},
    {"name": "crm", "description": "Customer relationship management endpoints."},
    {"name": "cup", "description": "Internal admin UI helpers."},
    {"name": "diagnostics", "description": "Diagnostics and health-check APIs."},
    {"name": "docs", "description": "Public documentation routes."},
    {"name": "integrations", "description": "External integrations APIs."},
    {"name": "navigation", "description": "Navigation layout customization endpoints."},
    {"name": "pricing", "description": "Pricing and plans APIs."},
    {"name": "products", "description": "Product catalogue APIs."},
    {"name": "profiles", "description": "Profile and public page management APIs."},
]

app = FastAPI(
    lifespan=lifespan,
    title="Intelligent Data Pro API",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    openapi_tags=tags_metadata,
    redirect_slashes=False,
    servers=[{"url": "/api/v1"}],
)
STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

NEXT_STATIC_DIR = Path(__file__).resolve().parent / ".next" / "static"
if NEXT_STATIC_DIR.exists():
    app.mount("/_next/static", StaticFiles(directory=str(NEXT_STATIC_DIR)), name="next-static")
else:
    logger.warning("Next.js static assets directory not found: %s", NEXT_STATIC_DIR)

NEXT_DATA_DIR = Path(__file__).resolve().parent / ".next" / "data"
if NEXT_DATA_DIR.exists():
    app.mount("/_next/data", StaticFiles(directory=str(NEXT_DATA_DIR)), name="next-data")

# Observability & security middlewares
app.add_middleware(LoggingMiddleware)

max_body = int(os.getenv("MAX_REQUEST_BODY_BYTES", "1048576"))
app.add_middleware(BodySizeLimitMiddleware, max_bytes=max_body)

if os.getenv("SECURITY_HEADERS_ENABLED", "1") == "1":
    csp_default = os.getenv("CSP_DEFAULT")
    if not csp_default:
        csp_default = build_csp()
    app.add_middleware(SecurityHeadersMiddleware, csp=csp_default)

if os.getenv("RATE_LIMIT_ENABLED", "0") == "1":
    app.add_middleware(
        RateLimitMiddleware,
        limit=60,
        period=60,
        paths=("/auth", "/calendar/feed"),
    )

if os.getenv("OTEL_ENABLED", "0") == "1":
    setup_tracing(app)

FAVICON_PATH = STATIC_DIR / "img" / "brand" / "favicon.svg"


@app.get("/favicon.ico", include_in_schema=False)
async def favicon() -> FileResponse:
    """Serve application favicon."""
    return FileResponse(FAVICON_PATH, media_type="image/svg+xml")


@app.get("/api", include_in_schema=False)
async def swagger_ui():
    """Serve Swagger UI for the public API.

    Note: our global CSP is strict (script-src/style-src 'self').
    FastAPI's Swagger UI pulls assets from jsdelivr and uses an inline
    init script. To avoid a blank page with only the header visible,
    we override CSP for this response to allow the required sources.
    """
    resp = get_swagger_ui_html(
        openapi_url="/api/v1/openapi.json",
        title="API v1 - Swagger UI",
    )
    # Narrowly relax CSP for Swagger UI only
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "img-src 'self' data: https:; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "font-src 'self' data: https://cdn.jsdelivr.net"
    )
    return resp

@app.get("/api/docs", include_in_schema=False)
async def swagger_docs_redirect():
    """Back-compat: redirect /api/docs -> /api (Swagger UI)."""
    return RedirectResponse("/api", status_code=307)


def _build_openapi_response() -> Response:
    data = app.openapi()
    text = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)
    return Response(text, media_type="application/json")


@app.get("/api/openapi.json", include_in_schema=False)
async def openapi_json() -> Response:
    return _build_openapi_response()


@app.get("/api/v1/openapi.json", include_in_schema=False)
async def openapi_json_v1() -> Response:
    return _build_openapi_response()



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
    if path.startswith("/static") or path.startswith("/favicon") or path.startswith("/_next/"):
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
        or path == "/api/docs"  # back-compat path
        or path == "/api/openapi.json"
        or path == "/api/v1/openapi.json"
        or path == "/api/v1/auth/tg-webapp/exchange"
    ):
        return await call_next(request)

    if path.startswith("/api/swagger-ui"):
        return await call_next(request)

    if path.startswith("/api/") and not path.startswith("/api/v1/") and path != "/api/openapi.json":
        dest = f"/api/v1/{path[5:]}"
        if request.url.query:
            dest += f"?{request.url.query}"
        return RedirectResponse(dest, status_code=308)

    # Allow other API paths to return their own status codes
    if path.startswith("/api/"):
        return await call_next(request)

    # Allow root path for both authenticated and guest users
    if path == "/":
        return await call_next(request)

    # Public marketing pages (Next.js static content)
    if (
        path.startswith("/pricing")
        or path.startswith("/tariffs")
        or path.startswith("/bot")
        or path.startswith("/docs")
        or path.startswith("/products")
    ):
        return await call_next(request)

    # Authenticated users can access other routes directly
    if web_user_id or telegram_id:
        return await call_next(request)

    # For everything else require login, preserving original destination
    next_url = request.url.path
    if request.url.query:
        next_url += "?" + request.url.query
    return RedirectResponse(f"/auth?next={quote(next_url, safe='')}")


@app.middleware("http")
async def api_version_header(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["X-API-Version"] = "v1"
    return response


app.include_router(index.router, include_in_schema=False)
app.include_router(settings.router, include_in_schema=False)
app.include_router(habits.ui_router, include_in_schema=False)
app.include_router(notes.ui_router, include_in_schema=False)
app.include_router(pricing.ui_router, include_in_schema=False)
app.include_router(products.ui_router, include_in_schema=False)
app.include_router(docs_public.ui_router, include_in_schema=False)
app.include_router(areas.ui_router, include_in_schema=False)
app.include_router(projects.ui_router, include_in_schema=False)
app.include_router(tasks.ui_router, include_in_schema=False)
app.include_router(resources.ui_router, include_in_schema=False)
app.include_router(calendar.ui_router, include_in_schema=False)
app.include_router(time_entries.ui_router, include_in_schema=False)
app.include_router(inbox.ui_router, include_in_schema=False)
app.include_router(groups.ui_router, include_in_schema=False)
app.include_router(auth.router, include_in_schema=False)
app.include_router(admin_ui.router, include_in_schema=False)
app.include_router(admin_ui.admin_ui_router, include_in_schema=False)

# Подключение всех API под единым префиксом
app.include_router(api_router, prefix="/api/v1")
app.include_router(system_routes.router, include_in_schema=False)
