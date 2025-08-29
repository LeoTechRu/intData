from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from core.models import Reminder, TgUser
from core.services.reminder_service import ReminderService
from web.dependencies import get_current_tg_user, get_current_web_user
from core.models import WebUser
from ..template_env import templates


router = APIRouter(prefix="/api/v1/reminders", tags=["reminders"])
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


@router.get("", response_model=List[ReminderResponse])
async def list_reminders(
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """List reminders for the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with ReminderService() as service:
        reminders = await service.list_reminders(
            owner_id=current_user.telegram_id,
        )
    return [ReminderResponse.from_model(r) for r in reminders]


@router.post(
    "",
    response_model=ReminderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_reminder(
    payload: ReminderCreate,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Create a reminder for the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with ReminderService() as service:
        reminder = await service.create_reminder(
            owner_id=current_user.telegram_id,
            message=payload.message,
            remind_at=payload.remind_at,
            task_id=payload.task_id,
        )
    return ReminderResponse.from_model(reminder)


@router.post("/{reminder_id}/done", response_model=ReminderResponse)
async def mark_reminder_done(
    reminder_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Mark the given reminder as done."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with ReminderService() as service:
        reminder = await service.mark_done(reminder_id)
        if reminder is None or reminder.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return ReminderResponse.from_model(reminder)


@ui_router.get("")
async def reminders_page(
    request: Request,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    """Render simple UI for reminders with role-aware header."""

    context = {
        "current_user": current_user,
        "current_role_name": getattr(current_user, "role", ""),
        "is_admin": getattr(current_user, "role", "") == "admin",
        "page_title": "Напоминания",
    }
    return templates.TemplateResponse(request, "reminders.html", context)
