from __future__ import annotations

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.models import TgUser, Alarm
from core.services.alarm_service import AlarmService
from web.dependencies import get_current_tg_user


router = APIRouter(tags=["calendar"])


class AlarmCreate(BaseModel):
    """Payload for creating an alarm."""

    trigger_at: datetime


class AlarmResponse(BaseModel):
    """Representation of an alarm."""

    id: int
    trigger_at: datetime

    @classmethod
    def from_model(cls, alarm: Alarm) -> "AlarmResponse":
        return cls(id=alarm.id, trigger_at=alarm.trigger_at)


@router.get("/calendar/items/{item_id}/alarms", response_model=List[AlarmResponse])
async def list_alarms(
    item_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """List alarms for a calendar item."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with AlarmService() as service:
        alarms = await service.list_for_item(current_user.telegram_id, item_id)
    return [AlarmResponse.from_model(a) for a in alarms]


@router.post(
    "/calendar/items/{item_id}/alarms",
    response_model=AlarmResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_alarm(
    item_id: int,
    payload: AlarmCreate,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Create an alarm for a calendar item."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with AlarmService() as service:
        alarm = await service.create_alarm(item_id=item_id, trigger_at=payload.trigger_at)
    return AlarmResponse.from_model(alarm)


# Alias for centralized API mounting
api = router
