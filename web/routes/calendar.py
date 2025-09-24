from __future__ import annotations

from datetime import UTC, datetime
from typing import List, Optional
import hashlib
import os

from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from pydantic import BaseModel, model_validator

from core.models import CalendarEvent, TgUser, WebUser, CalendarItem
from core.services.calendar_service import CalendarService
from core.services.para_repository import CalendarItemRepository
from core.services.telegram_user_service import TelegramUserService
from web.dependencies import get_current_tg_user, get_current_web_user
from .index import render_next_page


router = APIRouter(prefix="/calendar", tags=["Control Hub"])
ui_router = APIRouter(
    prefix="/calendar",
    tags=["Control Hub"],
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


# ---------------------------------------------------------------------------
# New calendar item endpoints
# ---------------------------------------------------------------------------


class CalendarItemBase(BaseModel):
    """Common fields for calendar items."""

    title: str
    start_at: datetime
    end_at: Optional[datetime] = None
    tzid: str
    description: Optional[str] = None
    project_id: int | None = None
    area_id: int | None = None


class CalendarItemCreate(CalendarItemBase):
    """Payload to create a calendar item."""

    @model_validator(mode="after")
    def check_scope(self):  # noqa: D401
        if (self.project_id is None) == (self.area_id is None):
            raise ValueError("provide exactly one of project_id or area_id")
        return self


class CalendarItemUpdate(BaseModel):
    """Partial update payload for a calendar item."""

    title: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    tzid: Optional[str] = None
    description: Optional[str] = None
    project_id: int | None = None
    area_id: int | None = None

    @model_validator(mode="after")
    def check_scope(self):  # noqa: D401
        if self.project_id is not None and self.area_id is not None:
            raise ValueError("project_id and area_id are mutually exclusive")
        return self


class CalendarItemResponse(CalendarItemBase):
    """Calendar item returned in API responses."""

    id: int

    @classmethod
    def from_model(
        cls, item: CalendarItem, tzid: str = "UTC"
    ) -> "CalendarItemResponse":
        return cls(
            id=item.id,
            title=item.title,
            start_at=item.start_at,
            end_at=item.end_at,
            description=item.description,
            tzid=tzid,
            project_id=item.project_id,
            area_id=item.area_id,
        )


@router.post(
    "/items",
    response_model=CalendarItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_item(
    payload: CalendarItemCreate,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Create a calendar item."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with CalendarItemRepository() as repo:
        item = await repo.create(
            owner_id=current_user.telegram_id,
            title=payload.title,
            start_at=payload.start_at,
            end_at=payload.end_at,
            project_id=payload.project_id,
            area_id=payload.area_id,
        )
    return CalendarItemResponse.from_model(item, tzid=payload.tzid)


@router.get("/items/{item_id}", response_model=CalendarItemResponse)
async def get_item(
    item_id: int, current_user: TgUser | None = Depends(get_current_tg_user)
):
    """Return calendar item by ID."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with CalendarItemRepository() as repo:
        item = await repo.get(item_id)
    if not item or item.owner_id != current_user.telegram_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return CalendarItemResponse.from_model(item)


@router.patch("/items/{item_id}", response_model=CalendarItemResponse)
async def update_item(
    item_id: int,
    payload: CalendarItemUpdate,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Update fields of a calendar item."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with CalendarItemRepository() as repo:
        item = await repo.get(item_id)
        if not item or item.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        updates = payload.dict(exclude_unset=True)
        updates.pop("tzid", None)
        item = await repo.update(item_id, **updates)
    return CalendarItemResponse.from_model(
        item, tzid=payload.tzid or "UTC"
    )


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: int, current_user: TgUser | None = Depends(get_current_tg_user)
):
    """Delete calendar item."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with CalendarItemRepository() as repo:
        item = await repo.get(item_id)
        if not item or item.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        await repo.delete(item_id)
    return None




@router.get("/agenda", response_model=List[CalendarItemResponse])
async def agenda(
    from_dt: datetime = Query(alias="from"),
    to_dt: datetime = Query(alias="to"),
    area_id: int | None = None,
    project_id: int | None = None,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Return items within the provided time range."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with CalendarItemRepository() as repo:
        items = await repo.list(
            owner_id=current_user.telegram_id,
            project_id=project_id,
            area_id=area_id,
            start_from=from_dt,
            start_to=to_dt,
        )
    return [CalendarItemResponse.from_model(i) for i in items]


def _to_utc(dt: datetime) -> datetime:
    """Normalize datetime to UTC with tzinfo."""

    if dt.tzinfo is not None:
        return dt.astimezone(UTC)
    return dt.replace(tzinfo=UTC)


def _format_ics_datetime(dt: datetime) -> str:
    """Return iCalendar-compatible UTC timestamp."""

    return _to_utc(dt).strftime("%Y%m%dT%H%M%SZ")


def _append_valarms(lines: list[str], item: CalendarItem) -> None:
    """Append VALARM blocks derived from item's alarms."""

    alarms = [
        alarm
        for alarm in getattr(item, "alarms", [])
        if getattr(alarm, "trigger_at", None) is not None
    ]
    for alarm in sorted(alarms, key=lambda a: _to_utc(a.trigger_at)):
        trigger = _format_ics_datetime(alarm.trigger_at)
        lines.append("BEGIN:VALARM")
        lines.append(f"TRIGGER;VALUE=DATE-TIME:{trigger}")
        lines.append("ACTION:DISPLAY")
        lines.append(f"DESCRIPTION:{item.title}")
        lines.append("END:VALARM")


def _generate_ics(items: list[CalendarItem]) -> str:
    """Create a minimal iCalendar feed for events and tasks."""

    from core.utils import utcnow

    now = _format_ics_datetime(utcnow())
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//intData//EN"]
    for e in items:
        if e.end_at:
            lines.append("BEGIN:VEVENT")
            lines.append(f"UID:{e.id}@intData")
            lines.append(f"DTSTAMP:{now}")
            lines.append(f"DTSTART:{_format_ics_datetime(e.start_at)}")
            lines.append(f"DTEND:{_format_ics_datetime(e.end_at)}")
            lines.append(f"SUMMARY:{e.title}")
            _append_valarms(lines, e)
            lines.append("END:VEVENT")
        else:
            lines.append("BEGIN:VTODO")
            lines.append(f"UID:{e.id}@intData")
            lines.append(f"DTSTAMP:{now}")
            lines.append(f"DUE:{_format_ics_datetime(e.start_at)}")
            lines.append(f"SUMMARY:{e.title}")
            lines.append(f"STATUS:{e.status.value.upper()}")
            _append_valarms(lines, e)
            lines.append("END:VTODO")
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


@router.get("/feed.ics")
async def feed(
    scope: str = "all",
    id: int | None = None,
    token: str | None = None,
):
    """Return iCalendar feed using token-based access."""

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    async with TelegramUserService() as users:
        user = await users.get_user_by_ics_token_hash(token_hash)
        if not user:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    async with CalendarItemRepository() as repo:
        if scope == "project" and id:
            events = await repo.list(owner_id=user.telegram_id, project_id=id)
        elif scope == "area" and id:
            events = await repo.list(owner_id=user.telegram_id, area_id=id)
        else:
            events = await repo.list(owner_id=user.telegram_id)
    ics = _generate_ics(events)
    return Response(content=ics, media_type="text/calendar")


@ui_router.get("/feed.ics")
async def feed_ui(
    scope: str = "all",
    id: int | None = None,
    token: str | None = None,
):
    """Proxy to API feed for user-facing ICS URL."""
    return await feed(scope=scope, id=id, token=token)


@ui_router.get("")
async def calendar_page(
    current_user: WebUser | None = Depends(get_current_web_user),
):
    """Serve the modern Next.js calendar page."""

    _ = current_user  # роль проверяется внутри приложения
    return render_next_page("calendar")


# Alias for centralized API mounting
api = router
