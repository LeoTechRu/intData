from __future__ import annotations

from datetime import date as dt_date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from core.models import Habit, TgUser, WebUser
from core.services.nexus_service import HabitService
from web.dependencies import get_current_tg_user, get_current_web_user
from ..template_env import templates


router = APIRouter(prefix="/habits", tags=["habits"])
ui_router = APIRouter(
    prefix="/habits",
    tags=["habits"],
    include_in_schema=False,
)


class HabitCreate(BaseModel):
    """Schema for creating a habit."""

    name: str
    frequency: str = Field(
        ...,
        pattern="^(daily|weekly|monthly)$",
    )
    area_id: Optional[int] = None
    project_id: Optional[int] = None


class AreaOut(BaseModel):
    id: int
    name: str
    slug: Optional[str] = None


class ProjectOut(BaseModel):
    id: int
    name: str


class HabitResponse(BaseModel):
    """Schema returned for habit endpoints."""

    id: int
    name: str
    frequency: str
    progress: List[str]
    area: AreaOut
    project: Optional[ProjectOut] = None

    @classmethod
    def from_model(cls, habit: Habit) -> "HabitResponse":
        progress = [k for k, v in (habit.progress or {}).items() if v]
        area = habit.area
        project = habit.project
        return cls(
            id=habit.id,
            name=habit.name,
            frequency=habit.frequency,
            progress=progress,
            area=AreaOut(
                id=area.id,
                name=area.name,
                slug=getattr(area, "slug", None),
            ),
            project=(
                ProjectOut(id=project.id, name=project.name)
                if project
                else None
            ),
        )


class TogglePayload(BaseModel):
    date: dt_date


@router.get("", response_model=List[HabitResponse])
async def list_habits(
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with HabitService() as service:
        habits = await service.list_habits(
            owner_id=current_user.telegram_id
        )
    return [HabitResponse.from_model(h) for h in habits]


@router.post(
    "",
    response_model=HabitResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_habit(
    payload: HabitCreate,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with HabitService() as service:
        habit = await service.create_habit(
            owner_id=current_user.telegram_id,
            name=payload.name,
            frequency=payload.frequency,
            area_id=payload.area_id,
            project_id=payload.project_id,
        )
        await service.session.refresh(
            habit,
            attribute_names=["area", "project"],
        )
    return HabitResponse.from_model(habit)


@router.post("/{habit_id}/toggle", response_model=HabitResponse)
async def toggle_habit_progress(
    habit_id: int,
    payload: TogglePayload,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with HabitService() as service:
        habit = await service.get(habit_id)
        if habit is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        if habit.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        updated = await service.toggle_progress(habit_id, payload.date)
        await service.session.refresh(
            updated,
            attribute_names=["area", "project"],
        )
    return HabitResponse.from_model(updated)


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(
    habit_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with HabitService() as service:
        habit = await service.get(habit_id)
        if habit is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        if habit.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        await service.delete(habit_id)
    return None


@ui_router.get("")
async def habits_page(
    request: Request,
    current_user: WebUser | None = Depends(get_current_web_user),
    tg_user: TgUser | None = Depends(get_current_tg_user),
):
    habits = []
    if tg_user:
        async with HabitService() as svc:
            habits = await svc.list_habits(owner_id=tg_user.telegram_id)
    context = {
        "current_user": current_user,
        "current_role_name": getattr(current_user, "role", ""),
        "is_admin": getattr(current_user, "role", "") == "admin",
        "page_title": "Привычки",
        "habits": habits,
    }
    return templates.TemplateResponse(request, "habits.html", context)

# Alias for centralized API mounting
api = router
