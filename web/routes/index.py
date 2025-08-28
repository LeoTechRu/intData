from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Request, Depends, status

from core.models import UserRole, WebUser, TgUser, TaskStatus
from core.services.telegram_user_service import TelegramUserService
from core.services.nexus_service import ProjectService
from core.services.task_service import TaskService
from core.services.reminder_service import ReminderService
from core.services.calendar_service import CalendarService
from core.services.time_service import TimeService
from core.utils import utcnow
from web.dependencies import get_current_web_user
from ..template_env import templates

router = APIRouter()


@router.get("/bot", include_in_schema=False)
async def bot_landing(request: Request):
    page_title = (
        "@LeonidBot — Telegram бот проекта "
        f"{templates.env.globals['APP_BRAND_NAME']}"
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
    if current_user and current_user.role == "ban":
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
            role_name = tg_user.role if tg_user else current_user.role

            now = utcnow()
            week_ago = now - timedelta(days=7)

            tasks = []
            reminders = []
            events = []
            entries = []
            if tg_user:
                async with TaskService() as ts:
                    tasks = await ts.list_tasks(owner_id=tg_user.telegram_id)
                async with ReminderService() as rs:
                    reminders = await rs.list_reminders(
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
                    ((e.end_time or now) - e.start_time).total_seconds()
                    for e in entries
                    if (e.end_time or now) >= week_ago
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
            for r in reminders:
                if r.remind_at.date() == today:
                    day_timeline.append(
                        {"time": r.remind_at.strftime("%H:%M"), "text": r.message}
                    )
            day_timeline.sort(key=lambda x: x["time"])

            upcoming_tasks = [
                {
                    "title": t.title,
                    "subtitle": t.due_date.strftime("%d.%m") if t.due_date else None,
                }
                for t in tasks
                if t.due_date and t.due_date >= now
            ][:5]
            upcoming_reminders = [
                {
                    "title": r.message,
                    "subtitle": r.remind_at.strftime("%H:%M"),
                }
                for r in reminders
                if r.remind_at >= now
            ][:5]
            upcoming_events = [
                {
                    "title": e.title,
                    "subtitle": e.start_at.strftime("%d.%m %H:%M"),
                }
                for e in events
                if e.start_at >= now
            ][:5]
            habit_list = []

            context = {
                "user": tg_user,
                "current_user": current_user,
                "profile_user": current_user,
                "owned_groups": owned_groups,
                "member_groups": member_groups,
                "owned_projects": owned_projects,
                "member_projects": member_projects,
                "role_name": role_name,
                "current_role_name": current_user.role,
                "is_admin": UserRole[role_name] >= UserRole.admin,
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
                "upcoming_reminders": upcoming_reminders,
                "upcoming_events": upcoming_events,
                "habit_list": habit_list,
                "page_title": "Дашборд",
            }
            return templates.TemplateResponse(request, "start.html", context)

    from fastapi.responses import RedirectResponse

    return RedirectResponse("/auth", status_code=status.HTTP_302_FOUND)
