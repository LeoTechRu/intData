from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from pydantic import BaseModel

from core.models import Task, TaskStatus, TgUser
from core.services.task_service import TaskService
from web.dependencies import get_current_tg_user, get_current_web_user
from core.models import WebUser
from ..template_env import templates


router = APIRouter(prefix="/api/tasks", tags=["tasks"])
ui_router = APIRouter(prefix="/tasks", tags=["tasks"], include_in_schema=False)


class TaskCreate(BaseModel):
    """Payload for creating a task."""

    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    project_id: Optional[int] = None
    area_id: Optional[int] = None


class TaskResponse(BaseModel):
    """Representation of a task for responses."""

    id: int
    title: str
    description: Optional[str]
    status: str
    due_date: Optional[datetime]
    tracked_minutes: int = 0
    running_entry_id: Optional[int] = None

    @classmethod
    def from_model(cls, task: Task, *, tracked_minutes: int = 0, running_entry_id: int | None = None) -> "TaskResponse":
        return cls(
            id=task.id,
            title=task.title,
            description=task.description,
            status=(
                task.status.value
                if isinstance(task.status, TaskStatus)
                else task.status
            ),
            due_date=task.due_date,
            tracked_minutes=tracked_minutes,
            running_entry_id=running_entry_id,
        )


class TaskTodayItem(BaseModel):
    """Lightweight representation of a task due today (UTC)."""

    id: int
    title: str
    date: str | None = None
    time: str | None = None
    due_date: str | None = None
    due_time: str | None = None


@router.get("/today", response_model=List[TaskTodayItem])
async def list_tasks_today(
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Return tasks whose ``due_date`` is today (UTC)."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    # Fetch all tasks for user and filter by UTC date
    async with TaskService() as service:
        tasks = await service.list_tasks(owner_id=current_user.telegram_id)

    from datetime import UTC
    from core.utils import utcnow

    now = utcnow()
    if getattr(now, "tzinfo", None) is None:
        now = now.replace(tzinfo=UTC)
    today = now.date()

    items: list[TaskTodayItem] = []
    for t in tasks:
        dt = getattr(t, "due_date", None)
        if not dt:
            continue
        # ensure aware
        if getattr(dt, "tzinfo", None) is None:
            dt = dt.replace(tzinfo=UTC)
        if dt.date() != today:
            continue
        date_s = dt.date().isoformat()
        time_s = dt.strftime("%H:%M")
        items.append(
            TaskTodayItem(
                id=t.id,
                title=t.title,
                date=date_s,
                time=time_s,
                due_date=date_s,
                due_time=time_s,
            )
        )
    return items


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    current_user: TgUser | None = Depends(get_current_tg_user),
    project_id: int | None = Query(default=None),
    area_id: int | None = Query(default=None),
    include_sub: int | None = Query(default=0),
):
    """List tasks for the current Telegram user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TaskService() as service:
        tasks = await service.list_tasks_by_area(owner_id=current_user.telegram_id, area_id=area_id, include_sub=True) if (area_id is not None and include_sub) else await service.list_tasks(owner_id=current_user.telegram_id, project_id=project_id, area_id=area_id)
        # Enrich with time tracking info
        from core.services.time_service import TimeService
        time_svc = TimeService(service.session)
        enriched: list[TaskResponse] = []
        for t in tasks:
            mins = await service.total_tracked_minutes(t.id)
            running = await time_svc.get_running_entry(owner_id=current_user.telegram_id, task_id=t.id)
            enriched.append(TaskResponse.from_model(t, tracked_minutes=mins, running_entry_id=getattr(running, 'id', None)))
    return enriched


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task(
    payload: TaskCreate,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Create a new task for the current user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TaskService() as service:
        task = await service.create_task(
            owner_id=current_user.telegram_id,
            title=payload.title,
            description=payload.description,
            due_date=payload.due_date,
            project_id=payload.project_id,
            area_id=payload.area_id,
        )
    return TaskResponse.from_model(task)


@router.post("/{task_id}/done", response_model=TaskResponse)
async def mark_task_done(
    task_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    """Mark the given task as done."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TaskService() as service:
        task = await service.mark_done(task_id)
        if task is None or task.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    # on done we still may return time aggregates
    mins = await TaskService(service.session).total_tracked_minutes(task.id)
    from core.services.time_service import TimeService
    running = await TimeService(service.session).get_running_entry(owner_id=current_user.telegram_id, task_id=task.id)
    return TaskResponse.from_model(task, tracked_minutes=mins, running_entry_id=getattr(running, 'id', None))


@router.post("/{task_id}/start_timer", response_model=TaskResponse, name="api:tasks_start_timer")
async def start_timer_for_task(task_id: int, current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TaskService() as service:
        task = await service.update_task(task_id, )  # ensure task exists
        task = await service.session.get(Task, task_id)
        if task is None or task.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        from core.services.time_service import TimeService
        time_svc = TimeService(service.session)
        try:
            await time_svc.start_timer(owner_id=current_user.telegram_id, task_id=task_id, description=task.title, create_task_if_missing=False)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        mins = await service.total_tracked_minutes(task_id)
        running = await time_svc.get_running_entry(owner_id=current_user.telegram_id, task_id=task_id)
        return TaskResponse.from_model(task, tracked_minutes=mins, running_entry_id=getattr(running, 'id', None))


@router.post("/{task_id}/stop_timer", response_model=TaskResponse, name="api:tasks_stop_timer")
async def stop_timer_for_task(task_id: int, current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TaskService() as service:
        task = await service.session.get(Task, task_id)
        if task is None or task.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        from core.services.time_service import TimeService
        time_svc = TimeService(service.session)
        running = await time_svc.get_running_entry(owner_id=current_user.telegram_id, task_id=task_id)
        if not running:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Нет активного таймера по этой задаче")
        await time_svc.stop_timer(running.id)
        mins = await service.total_tracked_minutes(task_id)
        return TaskResponse.from_model(task, tracked_minutes=mins, running_entry_id=None)


@ui_router.get("")
async def tasks_page(
    request: Request,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    """Render simple UI for tasks with role-aware header."""

    context = {
        "current_user": current_user,
        "current_role_name": getattr(current_user, "role", ""),
        "is_admin": getattr(current_user, "role", "") == "admin",
        "page_title": "Задачи",
    }
    return templates.TemplateResponse(request, "tasks.html", context)
