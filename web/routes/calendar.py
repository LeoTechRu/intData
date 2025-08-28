from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from core.models import CalendarEvent, TgUser
from core.services.calendar_service import CalendarService
from web.dependencies import get_current_tg_user, get_current_web_user
from core.models import WebUser
from ..template_env import templates


router = APIRouter(prefix="/api/calendar", tags=["calendar"])
ui_router = APIRouter(
    prefix="/calendar",
    tags=["calendar"],
    include_in_schema=False,
)


class EventCreate(BaseModel):
    """Payload for creating a calendar event."""

    title: str
    start_at: datetime
    end_at: Optional[datetime] = None
    description: Optional[str] = None


class EventResponse(BaseModel):
    """Representation of a calendar event."""

    id: int
    title: str
    start_at: datetime
    end_at: Optional[datetime]
    description: Optional[str]

    @classmethod
    def from_model(cls, event: CalendarEvent) -> "EventResponse":
        return cls(
            id=event.id,
            title=event.title,
            start_at=event.start_at,
            end_at=event.end_at,
            description=event.description,
        )


class EventTodayItem(BaseModel):
    """Lightweight representation of a calendar event starting today (UTC)."""

    id: int
    title: str
    date: str | None = None
    time: str | None = None
    due_date: str | None = None
    due_time: str | None = None


@router.get("/today", response_model=List[EventTodayItem])
async def list_events_today(
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Return events whose ``start_at`` is today (UTC)."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with CalendarService() as service:
        events = await service.list_events(owner_id=current_user.telegram_id)

    from datetime import UTC
    from core.utils import utcnow

    now = utcnow()
    if getattr(now, "tzinfo", None) is None:
        now = now.replace(tzinfo=UTC)
    today = now.date()

    items: list[EventTodayItem] = []
    for e in events:
        dt = getattr(e, "start_at", None)
        if not dt:
            continue
        if getattr(dt, "tzinfo", None) is None:
            dt = dt.replace(tzinfo=UTC)
        if dt.date() != today:
            continue
        date_s = dt.date().isoformat()
        time_s = dt.strftime("%H:%M")
        items.append(
            EventTodayItem(
                id=e.id,
                title=e.title,
                date=date_s,
                time=time_s,
                due_date=date_s,
                due_time=time_s,
            )
        )
    return items


@router.get("", response_model=List[EventResponse])
async def list_events(
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """List calendar events for the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with CalendarService() as service:
        events = await service.list_events(owner_id=current_user.telegram_id)
    return [EventResponse.from_model(e) for e in events]


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_event(
    payload: EventCreate,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Create a calendar event for the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with CalendarService() as service:
        event = await service.create_event(
            owner_id=current_user.telegram_id,
            title=payload.title,
            start_at=payload.start_at,
            end_at=payload.end_at,
            description=payload.description,
        )
    return EventResponse.from_model(event)


@ui_router.get("")
async def calendar_page(
    request: Request,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    """Render simple UI for calendar events with role-aware header."""

    context = {
        "current_user": current_user,
        "current_role_name": getattr(current_user, "role", ""),
        "is_admin": getattr(current_user, "role", "") == "admin",
        "page_title": "Календарь",
    }
    return templates.TemplateResponse(request, "calendar.html", context)
