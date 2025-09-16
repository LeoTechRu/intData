from __future__ import annotations

from datetime import timedelta
from functools import lru_cache
from pathlib import Path
import logging
import os
import subprocess

from fastapi import APIRouter, Request, Depends, status, HTTPException
from fastapi.responses import HTMLResponse, FileResponse

from core.models import WebUser, TgUser, TaskStatus
from core.services.telegram_user_service import TelegramUserService
from core.services.nexus_service import ProjectService, HabitService
from core.services.group_moderation_service import GroupModerationService
from core.services.task_service import TaskService
from core.services.alarm_service import AlarmService
from core.services.calendar_service import CalendarService
from core.services.time_service import TimeService
from core.utils import utcnow
from core.utils.habit_utils import calc_progress
from web.dependencies import get_current_web_user, get_effective_permissions
from ..template_env import templates

NEXT_build_ROOT = Path(__file__).resolve().parents[1] / ".next"
NEXT_APP_HTML_DIR = NEXT_build_ROOT / "server" / "app"
NEXT_STATIC_DIR = NEXT_build_ROOT / "static"
NEXT_SOURCE_DIR = Path(__file__).resolve().parents[1]

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/bot", include_in_schema=False)
async def bot_landing(request: Request):
    page_title = (
        "@intDataBot — Telegram бот проекта "
        f"{templates.env.globals['BRAND_NAME']}"
    )
    return templates.TemplateResponse(
        request,
        "bot_landing.html",
        {"page_title": page_title},
    )


@router.get("/ban", include_in_schema=False)
async def ban_page(request: Request):
    from fastapi.responses import HTMLResponse  # noqa: F401
    # отрендерим бан-страницу как шаблон без шапки
    return templates.TemplateResponse(request, "ban.html", {})


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
        async with TelegramUserService() as service, \
                ProjectService() as project_service:
            tg_user: TgUser | None = None
            owned_groups = []
            member_groups = []
            owned_projects = []
            member_projects = []
            group_moderation_overview = []
            if current_user.telegram_accounts:
                tg_user = current_user.telegram_accounts[0]
                all_groups = await service.list_user_groups(
                    tg_user.telegram_id,
                )
                owned_groups = [
                    g for g in all_groups if g.owner_id == tg_user.telegram_id
                ]
                member_groups = [
                    g for g in all_groups if g.owner_id != tg_user.telegram_id
                ]
                owned_projects = await project_service.list(
                    owner_id=tg_user.telegram_id,
                )
                if owned_groups or member_groups:
                    mod_service = GroupModerationService(service.session)
                    target_ids = {
                        g.telegram_id for g in owned_groups + member_groups
                    }
                    overview_raw = await mod_service.groups_overview(
                        group_ids=list(target_ids),
                        limit=5,
                        since_days=14,
                    )

                    def _format_last(dt):
                        if not dt:
                            return "—"
                        return dt.strftime("%d.%m %H:%M")

                    overview_raw.sort(
                        key=lambda item: (
                            item.get("unpaid_members", 0),
                            item.get("quiet_members", 0),
                        ),
                        reverse=True,
                    )
                    group_moderation_overview = [
                        {
                            "title": item["group"].title,
                            "members": item.get("members_total", 0),
                            "active": item.get("active_members", 0),
                            "quiet": item.get("quiet_members", 0),
                            "unpaid": item.get("unpaid_members", 0),
                            "last_activity": _format_last(item.get("last_activity")),
                            "group_id": item["group"].telegram_id,
                        }
                        for item in overview_raw[:3]
                    ]
            role_name = tg_user.role if tg_user else current_user.role

            # Use timezone-aware "now" and normalize model datetimes
            from datetime import UTC
            now = utcnow()
            if getattr(now, "tzinfo", None) is None:
                now = now.replace(tzinfo=UTC)

            def _aware(dt):
                if dt is None:
                    return None
                if getattr(dt, "tzinfo", None) is None:
                    return dt.replace(tzinfo=UTC)
                return dt
            week_ago = now - timedelta(days=7)

            tasks = []
            alarms = []
            events = []
            entries = []
            if tg_user:
                async with TaskService() as ts:
                    tasks = await ts.list_tasks(owner_id=tg_user.telegram_id)
                async with AlarmService() as asvc:
                    alarms = await asvc.list_upcoming(
                        owner_id=tg_user.telegram_id
                    )
                async with CalendarService() as cs:
                    events = await cs.list_events(owner_id=tg_user.telegram_id)
                async with TimeService() as time_svc:
                    entries = await time_svc.list_entries(
                        owner_id=tg_user.telegram_id
                    )

            kpi_goals = sum(1 for t in tasks if t.status == TaskStatus.done)
            kpi_focus_week = (
                sum(
                    ((_aware(e.end_time) or now) - _aware(e.start_time)).total_seconds()
                    for e in entries
                    if (_aware(e.end_time) or now) >= week_ago
                )
                / 3600
            )
            kpi_focus_week_delta = 0
            kpi_goals_delta = 0
            kpi_focused_hours = kpi_focus_week
            kpi_focused_hours_delta = 0
            kpi_health = 0
            kpi_health_delta = 0

            today = now.date()
            day_timeline = []
            for e in events:
                if e.start_at.date() == today:
                    day_timeline.append(
                        {"time": e.start_at.strftime("%H:%M"), "text": e.title}
                    )
            for a in alarms:
                if a.trigger_at.date() == today:
                    title = getattr(a.item, "title", "")
                    day_timeline.append(
                        {
                            "time": a.trigger_at.strftime("%H:%M"),
                            "text": title,
                        }
                    )
            day_timeline.sort(key=lambda x: x["time"])

            upcoming_tasks = [
                {
                    "title": t.title,
                    "subtitle": (
                        _aware(t.due_date).strftime("%d.%m") if t.due_date else None
                    ),
                }
                for t in tasks
                if t.due_date and _aware(t.due_date) >= now
            ][:5]
            upcoming_alarms = [
                {
                    "title": getattr(a.item, "title", ""),
                    "subtitle": a.trigger_at.strftime("%H:%M"),
                }
                for a in alarms
                if _aware(a.trigger_at) >= now
            ][:5]
            upcoming_events = [
                {
                    "title": e.title,
                    "subtitle": e.start_at.strftime("%d.%m %H:%M"),
                }
                for e in events
                if _aware(e.start_at) >= now
            ][:5]
            habit_list = []
            if tg_user:
                async with HabitService() as hs:
                    try:
                        habits = await hs.list_habits(
                            owner_id=tg_user.telegram_id
                        )
                    except Exception:  # pragma: no cover
                        habits = []
                habit_list = [
                    {
                        "title": h.name,
                        "percent": calc_progress(h.progress),
                    }
                    for h in habits
                ]

            effective = await get_effective_permissions(
                request, current_user=current_user
            )

            context = {
                "user": tg_user,
                "current_user": current_user,
                "profile_user": current_user,
                "owned_groups": owned_groups,
                "member_groups": member_groups,
                "group_moderation_overview": group_moderation_overview,
                "owned_projects": owned_projects,
                "member_projects": member_projects,
                "role_name": role_name,
                "current_role_name": current_user.role,
                "is_admin": bool(effective and effective.has_role("admin")),
                "kpi_focus_week": round(kpi_focus_week, 2),
                "kpi_focus_week_delta": kpi_focus_week_delta,
                "kpi_goals": kpi_goals,
                "kpi_goals_delta": kpi_goals_delta,
                "kpi_focused_hours": round(kpi_focused_hours, 2),
                "kpi_focused_hours_delta": kpi_focused_hours_delta,
                "kpi_health": kpi_health,
                "kpi_health_delta": kpi_health_delta,
                "day_timeline": day_timeline,
                "upcoming_tasks": upcoming_tasks,
                "upcoming_alarms": upcoming_alarms,
                "upcoming_events": upcoming_events,
                "habit_list": habit_list,
                "page_title": "ЦУП",
                "page_title_tooltip": "Центр Управления Полётами",
            }
            if context["is_admin"]:
                context.update(
                    {
                        "admin_anchor_id": "cup-admin-tools",
                        "admin_heading_description": (
                            "Админские утилиты доступны только вам. "
                        ),
                        "admin_iframe_src": "/cup/admin-embed",
                    }
                )
            return templates.TemplateResponse(request, "start.html", context)

    from fastapi.responses import RedirectResponse

    return RedirectResponse("/auth", status_code=status.HTTP_302_FOUND)


@lru_cache(maxsize=None)
def _load_next_html(page: str) -> str:
    html_path = NEXT_APP_HTML_DIR / f"{page}.html"
    if not html_path.exists():
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
            if html_path.exists():
                return html_path.read_text(encoding="utf-8")
        raise HTTPException(status_code=500, detail=f"Next.js page '{page}' отсутствует — запустите npm run build")
    return html_path.read_text(encoding="utf-8")


@router.get("/_next/static/{asset_path:path}", include_in_schema=False, response_class=FileResponse)
async def next_static(asset_path: str) -> FileResponse:
    target = NEXT_STATIC_DIR / asset_path
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404)
    return FileResponse(target)


@router.get("/users", include_in_schema=False, response_class=HTMLResponse)
@router.get("/users/", include_in_schema=False, response_class=HTMLResponse)
async def users_directory_page() -> HTMLResponse:
    return HTMLResponse(_load_next_html("users"))


@router.get("/users/{slug}", include_in_schema=False, response_class=HTMLResponse)
@router.get("/users/{slug}/", include_in_schema=False, response_class=HTMLResponse)
async def users_profile_page(slug: str) -> HTMLResponse:  # noqa: ARG001 - handled client-side
    return HTMLResponse(_load_next_html("users"))
