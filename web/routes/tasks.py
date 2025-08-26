from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.models import Task, TaskStatus, TgUser
from core.services.task_service import TaskService
from web.dependencies import get_current_tg_user


router = APIRouter(prefix="/tasks", tags=["tasks"])


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
