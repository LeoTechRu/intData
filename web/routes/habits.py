from __future__ import annotations

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.models import Habit, TgUser
from core.services.nexus_service import HabitService
from web.dependencies import get_current_tg_user


router = APIRouter(prefix="/habits", tags=["habits"])


class HabitCreate(BaseModel):
    """Schema for creating a habit."""

    name: str
    frequency: str = Field(..., pattern="^(daily|weekly|monthly)$")


class HabitResponse(BaseModel):
    """Schema returned for habit endpoints."""

    id: int
    name: str
    frequency: str | None
    progress: List[str]

    @classmethod
    def from_model(cls, habit: Habit) -> "HabitResponse":
        schedule = habit.schedule or {}
        metrics = habit.metrics or {}
        return cls(
            id=habit.id,
            name=habit.name,
            frequency=schedule.get("frequency"),
            progress=list(metrics.get("progress", [])),
        )


class TogglePayload(BaseModel):
    date: date


@router.get("", response_model=List[HabitResponse])
async def list_habits(current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with HabitService() as service:
        habits = await service.list(owner_id=current_user.telegram_id)
    return [HabitResponse.from_model(h) for h in habits]


@router.post("", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
async def create_habit(
    payload: HabitCreate, current_user: TgUser | None = Depends(get_current_tg_user)
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with HabitService() as service:
        habit = await service.create(
            owner_id=current_user.telegram_id,
            name=payload.name,
            schedule={"frequency": payload.frequency},
            metrics={"progress": []},
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
        if hasattr(service, "toggle_progress"):
            updated = await service.toggle_progress(habit_id, payload.date)
        else:
            metrics = habit.metrics or {}
            progress = metrics.get("progress", [])
            date_str = payload.date.isoformat()
            if date_str in progress:
                progress.remove(date_str)
            else:
                progress.append(date_str)
            metrics["progress"] = progress
            updated = await service.update(habit_id, metrics=metrics)
    return HabitResponse.from_model(updated)


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(habit_id: int, current_user: TgUser | None = Depends(get_current_tg_user)):
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

# Alias for centralized API mounting
api = router
