from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request, Depends, status
from fastapi.templating import Jinja2Templates

from core.models import UserRole, WebUser, TgUser
from core.services.telegram_user_service import TelegramUserService
from core.services.nexus_service import ProjectService
from web.dependencies import get_current_web_user
from web.config import S

router = APIRouter()


TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))
templates.env.globals.update(
    APP_BRAND_NAME="LeonidPro",
    APP_BASE_URL="https://leonid.pro",
    BOT_USERNAME="@LeonidBot",
    BOT_LANDING_URL="https://leonid.pro/bot",
)


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

            kpi_focus_week = 12
            kpi_focus_week_delta = 4.5
            kpi_goals = 3
            kpi_goals_delta = 33.3
            kpi_focused_hours = 42
            kpi_focused_hours_delta = 12.0
            kpi_health = 72
            kpi_health_delta = -1.2
            day_timeline = [
                {"time": "08:30", "text": "Утренняя зарядка"},
                {"time": "09:30", "text": "Планирование дня"},
                {"time": "19:00", "text": "Чтение / самообразование"},
            ]
            upcoming_tasks = [
                {"title": "Подготовить отчёт", "subtitle": "до 18:00"},
                {"title": "Ревью pull request", "subtitle": "завтра"},
            ]
            upcoming_reminders = [
                {"title": "Выпить воду", "subtitle": "каждые 2 часа"},
                {"title": "Размяться", "subtitle": "через 30 минут"},
            ]
            upcoming_events = [
                {"title": "Встреча с командой", "subtitle": "Пн 10:00"},
                {"title": "Демо проекта", "subtitle": "Пт 16:00"},
            ]
            habit_list = [
                {"title": "Чтение", "subtitle": "3 дня подряд"},
                {"title": "Медитация", "subtitle": "5 дней подряд"},
            ]
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
                "kpi_focus_week": kpi_focus_week,
                "kpi_focus_week_delta": kpi_focus_week_delta,
                "kpi_goals": kpi_goals,
                "kpi_goals_delta": kpi_goals_delta,
                "kpi_focused_hours": kpi_focused_hours,
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

    bot_user = S.TELEGRAM_BOT_USERNAME
    return templates.TemplateResponse(
        request,
        "auth/login.html",
        {
            "bot_username": bot_user,
            "telegram_id": request.cookies.get("telegram_id"),
            "page_title": "Вход",
        },
    )
