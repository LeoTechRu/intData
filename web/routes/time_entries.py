from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from core.models import TimeEntry, TgUser
from core.services.time_service import TimeService
from web.dependencies import get_current_tg_user, get_current_web_user
from core.models import WebUser
from ..template_env import templates


router = APIRouter(prefix="/api/time", tags=["time"])
ui_router = APIRouter(prefix="/time", tags=["time"], include_in_schema=False)


class StartPayload(BaseModel):
    """Payload to start a timer."""

    description: Optional[str] = None


class TimeEntryResponse(BaseModel):
    """Representation of a time entry."""

    id: int
    start_time: str
    end_time: Optional[str]
    description: Optional[str]

    @classmethod
    def from_model(cls, entry: TimeEntry) -> "TimeEntryResponse":
        return cls(
            id=entry.id,
            start_time=entry.start_time.isoformat(),
            end_time=entry.end_time.isoformat() if entry.end_time else None,
            description=entry.description,
        )


@router.post(
    "/start",
    response_model=TimeEntryResponse,
    status_code=status.HTTP_201_CREATED,
    name="timer_start",
)
async def start_timer(
    payload: StartPayload,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Start a new timer for the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TimeService() as service:
        entry = await service.start_timer(
            owner_id=current_user.telegram_id,
            description=payload.description,
        )
    return TimeEntryResponse.from_model(entry)


@router.post("/{entry_id}/stop", response_model=TimeEntryResponse, name="timer_stop")
async def stop_timer(
    entry_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Stop the timer for the given entry if owned by user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TimeService() as service:
        entry = await service.stop_timer(entry_id)
        if entry is None or entry.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return TimeEntryResponse.from_model(entry)


@router.get("", response_model=List[TimeEntryResponse], name="timer_status")
async def list_entries(
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """List time entries for the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TimeService() as service:
        entries = await service.list_entries(
            owner_id=current_user.telegram_id,
        )
    return [TimeEntryResponse.from_model(e) for e in entries]


@ui_router.get("")
async def time_page():
    from fastapi.responses import RedirectResponse
    return RedirectResponse("/", status_code=status.HTTP_302_FOUND)
