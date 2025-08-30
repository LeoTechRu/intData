from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from core.models import Reminder, TgUser
from core.services.reminder_service import ReminderService
from core.services.alarm_service import AlarmService
from web.dependencies import get_current_tg_user, get_current_web_user
from core.models import WebUser


router = APIRouter(tags=["reminders"])
ui_router = APIRouter(
    prefix="/reminders",
    tags=["reminders"],
    include_in_schema=False,
)


class ReminderCreate(BaseModel):
    """Payload for creating a reminder."""

    message: str
    remind_at: datetime
    task_id: Optional[int] = None


class ReminderResponse(BaseModel):
    """Representation of a reminder for responses."""

    id: int
    message: str
    remind_at: datetime
    task_id: Optional[int]
    is_done: bool

    @classmethod
    def from_model(cls, reminder: Reminder) -> "ReminderResponse":
        return cls(
            id=reminder.id,
            message=reminder.message,
            remind_at=reminder.remind_at,
            task_id=reminder.task_id,
            is_done=reminder.is_done,
        )


class ReminderTodayItem(BaseModel):
    """Lightweight representation of a reminder scheduled for today (UTC)."""

    id: int
    title: str
    date: str | None = None
    time: str | None = None
    due_date: str | None = None
    due_time: str | None = None


@router.get("/today", response_model=List[ReminderTodayItem])
async def list_reminders_today(
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Return reminders whose ``remind_at`` is today (UTC)."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with ReminderService() as service:
        reminders = await service.list_reminders(owner_id=current_user.telegram_id)

    from datetime import UTC
    from core.utils import utcnow

    now = utcnow()
    if getattr(now, "tzinfo", None) is None:
        now = now.replace(tzinfo=UTC)
    today = now.date()

    items: list[ReminderTodayItem] = []
    for r in reminders:
        dt = getattr(r, "remind_at", None)
        if not dt:
            continue
        if getattr(dt, "tzinfo", None) is None:
            dt = dt.replace(tzinfo=UTC)
        if dt.date() != today:
            continue
        date_s = dt.date().isoformat()
        time_s = dt.strftime("%H:%M")
        items.append(
            ReminderTodayItem(
                id=r.id,
                title=r.message,
                date=date_s,
                time=time_s,
                due_date=date_s,
                due_time=time_s,
            )
        )
    return items


@router.get("", response_model=List[ReminderResponse], deprecated=True)
async def list_reminders(
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """List upcoming alarms for the current user.

    Deprecated: use ``/api/v1/calendar/items/{item_id}/alarms``.
    """

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with AlarmService() as service:
        alarms = await service.list_upcoming(
            owner_id=current_user.telegram_id,
        )
    items: list[ReminderResponse] = []
    for alarm in alarms:
        title = getattr(alarm.item, "title", "")
        items.append(
            ReminderResponse(
                id=alarm.id,
                message=title or "",
                remind_at=alarm.trigger_at,
                task_id=None,
                is_done=False,
            )
        )
    return items


@router.post(
    "",
    response_model=ReminderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_reminder(
    payload: ReminderCreate,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Legacy endpoint no longer supported."""

    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Use /api/v1/calendar/items/{item_id}/alarms",
    )


@router.post("/{reminder_id}/done", response_model=ReminderResponse)
async def mark_reminder_done(
    reminder_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Legacy endpoint no longer supported."""

    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Use /api/v1/calendar/items/{item_id}/alarms",
    )


@ui_router.get("")
async def reminders_page(
    request: Request,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    """Redirect legacy reminders UI to calendar page."""

    return RedirectResponse("/calendar", status_code=status.HTTP_307_TEMPORARY_REDIRECT)


# Alias for centralized API mounting
api = router
