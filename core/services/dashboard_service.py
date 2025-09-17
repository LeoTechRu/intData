from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from pydantic import BaseModel, Field

from core.models import TaskStatus, WebUser
from core.services.alarm_service import AlarmService
from core.services.calendar_service import CalendarService
from core.services.group_moderation_service import GroupModerationService
from core.services.nexus_service import HabitService, ProjectService
from core.services.task_service import TaskService
from core.services.telegram_user_service import TelegramUserService
from core.services.time_service import TimeService
from core.utils import utcnow
from core.utils.habit_utils import calc_progress


class DashboardProfile(BaseModel):
    """Primary identity block for the overview dashboard."""

    display_name: str
    username: str
    email: str | None = None
    phone: str | None = None
    phone_href: str | None = None
    birthday: str | None = None
    language: str | None = None
    role: str | None = None


class DashboardMetric(BaseModel):
    id: str
    title: str
    value: str
    unit: str | None = None
    delta_percent: float | None = None


class DashboardListItem(BaseModel):
    id: str
    title: str
    subtitle: str | None = None
    url: str | None = None
    meta: dict[str, Any] | None = None


class DashboardTimelineItem(BaseModel):
    id: str
    kind: str = Field(description="event|alarm|reminder")
    title: str
    starts_at: str
    display_time: str


class DashboardHabitItem(BaseModel):
    id: int
    name: str
    percent: int


class DashboardOverview(BaseModel):
    profile: DashboardProfile | None = None
    metrics: dict[str, DashboardMetric] = Field(default_factory=dict)
    timeline: list[DashboardTimelineItem] = Field(default_factory=list)
    collections: dict[str, list[DashboardListItem]] = Field(default_factory=dict)
    habits: list[DashboardHabitItem] = Field(default_factory=list)
    generated_at: str


@dataclass(slots=True)
class _TimelineSource:
    identifier: str
    kind: str
    title: str
    scheduled_at: datetime


def _ensure_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if getattr(dt, "tzinfo", None) is None:
        return dt.replace(tzinfo=UTC)
    return dt


def _format_time(dt: datetime) -> tuple[str, str]:
    dt = _ensure_aware(dt) or utcnow().replace(tzinfo=UTC)
    if getattr(dt, "tzinfo", None) is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.isoformat(), dt.astimezone(UTC).strftime("%H:%M")


def _make_profile(user: WebUser) -> DashboardProfile:
    display_name = user.full_name or user.username or "Пользователь"
    username = user.username or "—"
    phone = getattr(user, "phone", None) or None
    phone_href: str | None = None
    if phone:
        phone_href = "tel:" + "".join(ch for ch in phone if ch.isdigit() or ch == "+")
    birthday = None
    if getattr(user, "birthday", None):
        birthday = user.birthday.strftime("%Y-%m-%d")
    language = getattr(user, "language", None)
    role = user.role
    return DashboardProfile(
        display_name=display_name,
        username=username,
        email=getattr(user, "email", None),
        phone=phone,
        phone_href=phone_href,
        birthday=birthday,
        language=language,
        role=role,
    )


async def build_dashboard_overview(user: WebUser) -> DashboardOverview:
    """Aggregate datasets required for the overview dashboard."""

    now = utcnow()
    if getattr(now, "tzinfo", None) is None:
        now = now.replace(tzinfo=UTC)
    week_ago = now - timedelta(days=7)

    metrics: dict[str, DashboardMetric] = {}
    collections: dict[str, list[DashboardListItem]] = {}
    timeline: list[_TimelineSource] = []
    habits_payload: list[DashboardHabitItem] = []

    telegram_account = user.telegram_accounts[0] if user.telegram_accounts else None

    owned_groups: list[DashboardListItem] = []
    member_groups: list[DashboardListItem] = []
    group_moderation_list: list[DashboardListItem] = []
    owned_projects: list[DashboardListItem] = []
    member_projects: list[DashboardListItem] = []

    if telegram_account:
        tg_id = telegram_account.telegram_id
        async with TelegramUserService() as tg_service, ProjectService() as project_service:
            all_groups = await tg_service.list_user_groups(tg_id)
            owned_groups_raw = [g for g in all_groups if g.owner_id == tg_id]
            member_groups_raw = [g for g in all_groups if g.owner_id != tg_id]

            owned_groups = [
                DashboardListItem(
                    id=f"group-owned-{group.telegram_id}",
                    title=group.title,
                    subtitle=f"{group.participants_count or 0} участников",
                    url=f"/groups/{group.telegram_id}",
                )
                for group in owned_groups_raw
            ]
            member_groups = [
                DashboardListItem(
                    id=f"group-member-{group.telegram_id}",
                    title=group.title,
                    subtitle=f"{group.participants_count or 0} участников",
                    url=f"/groups/{group.telegram_id}",
                )
                for group in member_groups_raw
            ]

            owned_projects_raw = await project_service.list(owner_id=tg_id)
            owned_projects = [
                DashboardListItem(
                    id=f"project-owned-{project.id}",
                    title=project.name,
                    url=f"/projects/{project.id}",
                )
                for project in owned_projects_raw
            ]

            if owned_groups_raw or member_groups_raw:
                moderation = GroupModerationService(tg_service.session)
                target_ids = {g.telegram_id for g in owned_groups_raw + member_groups_raw}
                overview_raw = await moderation.groups_overview(
                    group_ids=list(target_ids),
                    limit=5,
                    since_days=14,
                )

                def _format_last(dt: datetime | None) -> str:
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
                group_moderation_list = [
                    DashboardListItem(
                        id=f"group-moderation-{item['group'].telegram_id}",
                        title=item["group"].title,
                        subtitle=(
                            f"Активны: {item.get('active_members', 0)}/"
                            f"{item.get('members_total', 0)} · Без оплаты: {item.get('unpaid_members', 0)} · "
                            f"Тихие: {item.get('quiet_members', 0)} · Последняя активность: {_format_last(item.get('last_activity'))}"
                        ),
                        url=f"/groups/{item['group'].telegram_id}",
                        meta={
                            "members": item.get("members_total", 0),
                            "active": item.get("active_members", 0),
                            "quiet": item.get("quiet_members", 0),
                            "unpaid": item.get("unpaid_members", 0),
                            "last_activity": _format_last(item.get("last_activity")),
                        },
                    )
                    for item in overview_raw[:3]
                ]

        async with TaskService() as task_service:
            tasks = await task_service.list_tasks(owner_id=tg_id)
        async with AlarmService() as alarm_service:
            alarms = await alarm_service.list_upcoming(owner_id=tg_id)
        async with CalendarService() as calendar_service:
            events = await calendar_service.list_events(owner_id=tg_id)
        async with TimeService() as time_service:
            entries = await time_service.list_entries(owner_id=tg_id)
        async with HabitService() as habit_service:
            try:
                habits = await habit_service.list_habits(owner_id=tg_id)
            except Exception:  # pragma: no cover - defensive fallback
                habits = []

        completed_tasks = sum(1 for task in tasks if task.status == TaskStatus.done)
        metrics["goals"] = DashboardMetric(
            id="goals",
            title="Достижения",
            value=str(completed_tasks),
            delta_percent=0.0,
        )

        focus_hours = sum(
            (((_ensure_aware(entry.end_time) or now) - (_ensure_aware(entry.start_time) or now)).total_seconds())
            / 3600
            for entry in entries
            if (_ensure_aware(entry.end_time) or now) >= week_ago
        )
        metrics["focus_week"] = DashboardMetric(
            id="focus_week",
            title="Фокус за неделю",
            value=f"{round(focus_hours, 2)}",
            unit="ч",
            delta_percent=0.0,
        )
        metrics["focused_hours"] = DashboardMetric(
            id="focused_hours",
            title="Сфокусированные часы",
            value=f"{round(focus_hours, 2)}",
            unit="ч",
            delta_percent=0.0,
        )
        metrics["health"] = DashboardMetric(
            id="health",
            title="Здоровье",
            value="—",
            delta_percent=0.0,
        )

        collections["upcoming_tasks"] = []
        for task in tasks:
            due = _ensure_aware(getattr(task, "due_date", None))
            if due and due >= now:
                collections["upcoming_tasks"].append(
                    DashboardListItem(
                        id=f"task-{task.id}",
                        title=task.title,
                        subtitle=due.strftime("%d.%m"),
                        url=f"/tasks/{task.id}",
                    )
                )
        collections["upcoming_tasks"] = collections["upcoming_tasks"][:5]

        collections["reminders"] = []
        for alarm in alarms:
            trigger_at = _ensure_aware(alarm.trigger_at)
            if trigger_at and trigger_at >= now:
                collections["reminders"].append(
                    DashboardListItem(
                        id=f"alarm-{alarm.id}",
                        title=getattr(alarm.item, "title", ""),
                        subtitle=trigger_at.strftime("%H:%M"),
                        url="/calendar",
                    )
                )
        collections["reminders"] = collections["reminders"][:5]

        collections["next_events"] = []
        for event in events:
            start_at = _ensure_aware(event.start_at)
            if start_at and start_at >= now:
                collections["next_events"].append(
                    DashboardListItem(
                        id=f"event-{event.id}",
                        title=event.title,
                        subtitle=start_at.strftime("%d.%m %H:%M"),
                        url="/calendar",
                    )
                )
        collections["next_events"] = collections["next_events"][:5]

        timeline_sources: list[_TimelineSource] = []
        today = now.date()
        for event in events:
            start_ts = _ensure_aware(event.start_at)
            if start_ts and start_ts.date() == today:
                timeline_sources.append(
                    _TimelineSource(
                        identifier=f"event-{event.id}",
                        kind="event",
                        title=event.title,
                        scheduled_at=start_ts,
                    ),
                )
        for alarm in alarms:
            trigger_ts = _ensure_aware(alarm.trigger_at)
            if trigger_ts and trigger_ts.date() == today:
                title = getattr(alarm.item, "title", "")
                timeline_sources.append(
                    _TimelineSource(
                        identifier=f"alarm-{alarm.id}",
                        kind="alarm",
                        title=title,
                        scheduled_at=trigger_ts,
                    ),
                )
        timeline_sources.sort(key=lambda item: item.scheduled_at)
        timeline.extend(timeline_sources)

        habits_payload = [
            DashboardHabitItem(id=habit.id, name=habit.name, percent=calc_progress(habit.progress))
            for habit in habits
        ]

        member_projects = [
            DashboardListItem(
                id=f"project-member-{project.id}",
                title=project.name,
                url=f"/projects/{project.id}",
            )
            for project in owned_projects_raw
            if project.owner_id != tg_id
        ]

    collections["leader_groups"] = owned_groups
    collections["member_groups"] = member_groups
    collections["group_moderation"] = group_moderation_list
    collections["owned_projects"] = owned_projects
    collections["member_projects"] = member_projects

    timeline_payload = [
        DashboardTimelineItem(
            id=item.identifier,
            kind=item.kind,
            title=item.title,
            starts_at=_format_time(item.scheduled_at)[0],
            display_time=_format_time(item.scheduled_at)[1],
        )
        for item in timeline
    ]

    profile = _make_profile(user) if user else None

    return DashboardOverview(
        profile=profile,
        metrics=metrics,
        timeline=timeline_payload,
        collections=collections,
        habits=habits_payload,
        generated_at=now.isoformat(),
    )
