from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from backend.models import TimeEntry, TgUser
from backend.services.time_service import TimeService
from web.dependencies import get_current_tg_user

from .index import render_next_page


router = APIRouter(prefix="/time", tags=["Control Hub"])
ui_router = APIRouter(prefix="/time", tags=["Control Hub"], include_in_schema=False)


class StartPayload(BaseModel):
    """Payload to start a timer."""

    description: Optional[str] = None
    task_id: Optional[int] = None


class TimeEntryResponse(BaseModel):
    """Representation of a time entry."""

    id: int
    task_id: Optional[int]
    start_time: str
    end_time: Optional[str]
    description: Optional[str]
    active_seconds: int
    last_started_at: Optional[str]
    paused_at: Optional[str]
    is_running: bool
    is_paused: bool
    elapsed_seconds: int

    @staticmethod
    def _iso(dt: datetime | None) -> str | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace('+00:00', 'Z')

    @classmethod
    def from_model(cls, entry: TimeEntry) -> "TimeEntryResponse":
        last_started_at = cls._iso(entry.last_started_at)
        paused_at = cls._iso(entry.paused_at)
        end_time = cls._iso(entry.end_time)
        return cls(
            id=entry.id,
            task_id=entry.task_id,
            start_time=cls._iso(entry.start_time) or '',
            end_time=end_time,
            description=entry.description,
            active_seconds=entry.active_seconds or 0,
            last_started_at=last_started_at,
            paused_at=paused_at,
            is_running=entry.is_running,
            is_paused=entry.is_paused,
            elapsed_seconds=entry.duration_seconds or 0,
        )


class SummaryItem(BaseModel):
    total_seconds: int
    day: Optional[str] = None
    project_id: Optional[int] = None
    area_id: Optional[int] = None
    owner_id: Optional[int] = None


@router.post(
    "/start",
    response_model=TimeEntryResponse,
    status_code=status.HTTP_201_CREATED,
    name="api:time_start",
)
async def start_timer(
    payload: StartPayload,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Start a new timer for the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TimeService() as service:
        try:
            entry = await service.start_timer(
                owner_id=current_user.telegram_id,
                description=payload.description,
                task_id=payload.task_id,
                create_task_if_missing=True,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    return TimeEntryResponse.from_model(entry)


@router.post("/{entry_id}/pause", response_model=TimeEntryResponse, name="api:time_pause")
async def pause_timer(entry_id: int, current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TimeService() as service:
        try:
            entry = await service.pause_timer(entry_id, owner_id=current_user.telegram_id)
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    return TimeEntryResponse.from_model(entry)


@router.post("/{entry_id}/resume", response_model=TimeEntryResponse, name="api:time_resume_entry")
async def resume_entry(entry_id: int, current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TimeService() as service:
        try:
            entry = await service.resume_entry(entry_id, owner_id=current_user.telegram_id)
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    return TimeEntryResponse.from_model(entry)


@router.post("/{entry_id}/stop", response_model=TimeEntryResponse, name="api:time_stop")
async def stop_timer(
    entry_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Stop the timer for the given entry if owned by user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TimeService() as service:
        try:
            entry = await service.stop_timer(entry_id, owner_id=current_user.telegram_id)
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return TimeEntryResponse.from_model(entry)


@router.get("", response_model=List[TimeEntryResponse], name="api:time_status")
async def list_entries(
    current_user: TgUser | None = Depends(get_current_tg_user),
    area_id: int | None = Query(default=None),
    include_sub: int | None = Query(default=0),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    """List time entries for the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TimeService() as service:
        from datetime import datetime
        tf = datetime.fromisoformat(date_from) if date_from else None
        tt = datetime.fromisoformat(date_to) if date_to else None
        entries = await service.list_entries_filtered(
            owner_id=current_user.telegram_id, area_id=area_id, include_sub=bool(include_sub), time_from=tf, time_to=tt)
    return [TimeEntryResponse.from_model(e) for e in entries]


@router.get("/summary", response_model=List[SummaryItem], name="api:time_summary")
async def time_summary(
    group_by: str = Query("day"),
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Aggregate time entries for the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    if group_by not in {"day", "project", "area", "user"}:
        raise HTTPException(status_code=400, detail="invalid group_by")
    async with TimeService() as service:
        items = await service.summary(
            owner_id=current_user.telegram_id, group_by=group_by
        )
    return items


@router.get("/running", response_model=TimeEntryResponse | None, name="api:time_running")
async def get_running_entry(current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TimeService() as service:
        entry = await service.get_running_entry(owner_id=current_user.telegram_id)
    return TimeEntryResponse.from_model(entry) if entry else None


@router.post("/resume/{task_id}", response_model=TimeEntryResponse, name="api:time_resume")
async def resume_timer(
    task_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Resume work on a task by starting a new running entry for it."""
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TimeService() as service:
        try:
            entry = await service.resume_task(owner_id=current_user.telegram_id, task_id=task_id)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            # Likely conflict (already running another timer)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return TimeEntryResponse.from_model(entry)


class AssignTaskPayload(BaseModel):
    task_id: int


@router.post("/{entry_id}/assign_task", response_model=TimeEntryResponse, name="api:time_assign_task")
async def assign_task(entry_id: int, payload: AssignTaskPayload, current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TimeService() as service:
        try:
            entry = await service.assign_task(entry_id, payload.task_id, owner_id=current_user.telegram_id)
        except PermissionError as e:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    return TimeEntryResponse.from_model(entry)


@ui_router.get("", include_in_schema=False, response_class=HTMLResponse)
@ui_router.get("/", include_in_schema=False, response_class=HTMLResponse)
async def time_page() -> HTMLResponse:
    """Serve the modern Next.js time tracking page."""

    return render_next_page("time")


# Alias for centralized API mounting
api = router
