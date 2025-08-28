from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
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


class TaskResponse(BaseModel):
    """Representation of a task for responses."""

    id: int
    title: str
    description: Optional[str]
    status: str
    due_date: Optional[datetime]

    @classmethod
    def from_model(cls, task: Task) -> "TaskResponse":
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
):
    """List tasks for the current Telegram user."""

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with TaskService() as service:
        tasks = await service.list_tasks(
            owner_id=current_user.telegram_id,
        )
    return [TaskResponse.from_model(t) for t in tasks]


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
    return TaskResponse.from_model(task)


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
