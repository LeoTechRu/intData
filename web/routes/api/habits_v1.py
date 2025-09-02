"""Public API endpoints for Habitica-like module (habits/dailies/rewards)."""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from core.models import TgUser
from core.services.habits import (
    HabitsService,
    DailiesService,
    RewardsService,
    UserStatsService,
    HabitsCronService,
)
from web.dependencies import get_current_tg_user


router = APIRouter(tags=["habits"])


# ----------------------- Habits -----------------------


class HabitIn(BaseModel):
    title: str
    type: str
    difficulty: str
    note: Optional[str] = None
    area_id: Optional[int] = None
    project_id: Optional[int] = None


@router.post("/habits", status_code=201)
async def api_create_habit(
    payload: HabitIn,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    if payload.area_id is None and payload.project_id is None:
        raise HTTPException(status_code=400, detail="area_or_project_required")
    try:
        async with HabitsService() as svc:
            hid = await svc.create_habit(
                owner_id=current_user.telegram_id,
                title=payload.title,
                type=payload.type,
                difficulty=payload.difficulty,
                area_id=payload.area_id,
                project_id=payload.project_id,
                note=payload.note,
            )
    except ValueError:
        raise HTTPException(status_code=400, detail="area_or_project_required")
    return {"id": hid}


@router.post("/habits/{habit_id}/up")
async def api_habit_up(
    habit_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    async with HabitsService() as svc:
        res = await svc.up(habit_id, owner_id=current_user.telegram_id)
    if res is None:
        raise HTTPException(status_code=404)
    return res


@router.post("/habits/{habit_id}/down")
async def api_habit_down(
    habit_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    async with HabitsService() as svc:
        res = await svc.down(habit_id, owner_id=current_user.telegram_id)
    if res is None:
        raise HTTPException(status_code=404)
    return res


@router.get("/habits/stats")
async def api_stats(current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=401)
    async with UserStatsService() as svc:
        stats = await svc.get_or_create(current_user.telegram_id)
    stats.pop("owner_id", None)
    return stats


@router.post("/habits/cron/run")
async def api_cron_run(current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=401)
    async with HabitsCronService() as svc:
        ran = await svc.run(current_user.telegram_id)
    return {"ran": ran}


# ----------------------- Dailies -----------------------


class DailyIn(BaseModel):
    title: str
    rrule: str
    difficulty: str
    note: Optional[str] = None
    area_id: Optional[int] = None
    project_id: Optional[int] = None


@router.post("/dailies", status_code=201)
async def api_create_daily(
    payload: DailyIn,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    if payload.area_id is None and payload.project_id is None:
        raise HTTPException(status_code=400, detail="area_or_project_required")
    try:
        async with DailiesService() as svc:
            did = await svc.create_daily(
                owner_id=current_user.telegram_id,
                title=payload.title,
                rrule=payload.rrule,
                difficulty=payload.difficulty,
                area_id=payload.area_id,
                project_id=payload.project_id,
                note=payload.note,
            )
    except ValueError:
        raise HTTPException(status_code=400, detail="area_or_project_required")
    return {"id": did}


class DatePayload(BaseModel):
    date: Optional[date] = None


@router.post("/dailies/{daily_id}/done")
async def api_daily_done(
    daily_id: int,
    payload: DatePayload = Body(default=None),
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    on = payload.date if payload else None
    async with DailiesService() as svc:
        ok = await svc.done(daily_id, owner_id=current_user.telegram_id, on=on)
    if not ok:
        raise HTTPException(status_code=404)
    return {"ok": True}


@router.post("/dailies/{daily_id}/undo")
async def api_daily_undo(
    daily_id: int,
    payload: DatePayload = Body(default=None),
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    on = payload.date if payload else None
    async with DailiesService() as svc:
        ok = await svc.undo(daily_id, owner_id=current_user.telegram_id, on=on)
    if not ok:
        raise HTTPException(status_code=404)
    return {"ok": True}


# ----------------------- Rewards -----------------------


class RewardIn(BaseModel):
    title: str
    cost_gold: int
    area_id: Optional[int] = None
    project_id: Optional[int] = None


@router.post("/rewards", status_code=201)
async def api_create_reward(
    payload: RewardIn,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    if payload.area_id is None and payload.project_id is None:
        raise HTTPException(status_code=400, detail="area_or_project_required")
    try:
        async with RewardsService() as svc:
            rid = await svc.create(
                owner_id=current_user.telegram_id,
                title=payload.title,
                cost_gold=payload.cost_gold,
                area_id=payload.area_id,
                project_id=payload.project_id,
            )
    except ValueError:
        raise HTTPException(status_code=400, detail="area_or_project_required")
    return {"id": rid}


@router.get("/rewards")
async def api_list_rewards(
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    async with RewardsService() as svc:
        rewards = await svc.list(current_user.telegram_id)
    return rewards


@router.post("/rewards/{reward_id}/buy")
async def api_buy_reward(
    reward_id: int,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    try:
        async with RewardsService() as svc:
            gold_after = await svc.buy(reward_id, owner_id=current_user.telegram_id)
    except ValueError:
        return JSONResponse(
            status_code=400, content={"error": "insufficient_gold"}
        )
    if gold_after is None:
        raise HTTPException(status_code=404)
    return {"gold_after": gold_after}


# Alias for router include
api = router

