from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.models import Reminder, TgUser
from core.services.reminder_service import ReminderService
from web.dependencies import get_current_tg_user


router = APIRouter(prefix="/reminders", tags=["reminders"])


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
