from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import logging
import os
import subprocess

from fastapi import APIRouter, Request, Depends, status, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, Response

from web.dependencies import get_current_web_user
from ..security.csp import augment_csp, extract_inline_script_hashes

NEXT_build_ROOT = Path(__file__).resolve().parents[1] / ".next"
NEXT_APP_HTML_DIR = NEXT_build_ROOT / "server" / "app"
NEXT_HTML_ALIASES: dict[str, tuple[str, ...]] = {
    "page": ("index",),
}
NEXT_STATIC_DIR = NEXT_build_ROOT / "static"
NEXT_SOURCE_DIR = Path(__file__).resolve().parents[1]

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/bot", include_in_schema=False, response_class=HTMLResponse)
@router.get("/bot/", include_in_schema=False, response_class=HTMLResponse)
async def bot_landing() -> HTMLResponse:
    return render_next_page("bot")


@router.get("/docs", include_in_schema=False, response_class=HTMLResponse)
@router.get("/docs/", include_in_schema=False, response_class=HTMLResponse)
async def docs_landing() -> HTMLResponse:
    return render_next_page("docs")


@router.head("/docs", include_in_schema=False)
@router.head("/docs/", include_in_schema=False)
async def docs_landing_head() -> Response:
    html_response = render_next_page("docs")
    return Response(status_code=200, headers=dict(html_response.headers))


@router.get("/ban", include_in_schema=False, response_class=HTMLResponse)
async def ban_page() -> HTMLResponse:
    """Serve the Next.js ban page."""

    return render_next_page("ban")


@router.get("/", include_in_schema=False)
async def index(
    request: Request,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    """Render dashboard for authorised users or login page for guests."""
    if current_user and current_user.role in {"ban", "suspended"}:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(
            "/ban", status_code=status.HTTP_307_TEMPORARY_REDIRECT
        )
    if current_user:
        return render_next_page("page")

    from fastapi.responses import RedirectResponse

    return RedirectResponse("/auth", status_code=status.HTTP_302_FOUND)


@lru_cache(maxsize=None)
def _resolve_html_path(page: str) -> Path | None:
    html_path = NEXT_APP_HTML_DIR / f"{page}.html"
    if html_path.exists():
        return html_path
    for alias in NEXT_HTML_ALIASES.get(page, ()):  # pragma: no cover - fallback diff between Next versions
        alias_path = NEXT_APP_HTML_DIR / f"{alias}.html"
        if alias_path.exists():
            return alias_path
    return None


@lru_cache(maxsize=None)
def _load_next_html(page: str) -> str:
    html_path = _resolve_html_path(page)
    if html_path is None:
        auto_build = os.getenv("NEXT_AUTO_BUILD", "1") == "1"
        if auto_build:
            try:
                node_modules_dir = NEXT_SOURCE_DIR / "node_modules"
                if not node_modules_dir.exists():
                    logger.info("Node modules отсутствуют — запускаем npm ci")
                    ci_completed = subprocess.run(
                        ["npm", "ci"],
                        cwd=str(NEXT_SOURCE_DIR),
                        check=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                    )
                    logger.info("npm ci завершён (эмиссия %s байт)", len(ci_completed.stdout))
                logger.info("Next.js page '%s' отсутствует — запускаем npm run build", page)
                completed = subprocess.run(
                    ["npm", "run", "build"],
                    cwd=str(NEXT_SOURCE_DIR),
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                )
                logger.info("Next.js build завершён (эмиссия %s байт)", len(completed.stdout))
            except Exception as exc:  # pragma: no cover - build failures reported as HTTP error
                logger.error("Не удалось собрать Next.js: %s", exc)
                if isinstance(exc, subprocess.CalledProcessError) and exc.stderr:
                    logger.error("npm run build stderr:\n%s", exc.stderr.decode("utf-8", "ignore"))
            html_path = _resolve_html_path(page)
            if html_path is not None:
                return html_path.read_text(encoding="utf-8")
        raise HTTPException(status_code=500, detail=f"Next.js page '{page}' отсутствует — запустите npm run build")
    return html_path.read_text(encoding="utf-8")


@lru_cache(maxsize=None)
def _load_next_payload(page: str) -> tuple[str, tuple[str, ...]]:
    html = _load_next_html(page)
    script_hashes = extract_inline_script_hashes(html)
    return html, script_hashes


def render_next_page(page: str) -> HTMLResponse:
    html, script_hashes = _load_next_payload(page)
    response = HTMLResponse(html)
    if os.getenv("SECURITY_HEADERS_ENABLED", "1") == "1":
        base_csp = os.getenv("CSP_DEFAULT")
        response.headers["Content-Security-Policy"] = augment_csp(
            script_hashes,
            base=base_csp,
        )
    return response


@router.get("/_next/static/{asset_path:path}", include_in_schema=False, response_class=FileResponse)
async def next_static(asset_path: str) -> FileResponse:
    target = NEXT_STATIC_DIR / asset_path
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404)
    return FileResponse(target)


@router.get("/users", include_in_schema=False, response_class=HTMLResponse)
@router.get("/users/", include_in_schema=False, response_class=HTMLResponse)
async def users_directory_page() -> HTMLResponse:
    return render_next_page("users")


@router.get("/users/{slug}", include_in_schema=False, response_class=HTMLResponse)
@router.get("/users/{slug}/", include_in_schema=False, response_class=HTMLResponse)
async def users_profile_page(slug: str) -> HTMLResponse:  # noqa: ARG001 - handled client-side
    return render_next_page("users")
