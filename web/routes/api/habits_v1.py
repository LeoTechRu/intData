from datetime import date
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from core.auth.owner import OwnerCtx, get_current_owner
from core.services.errors import CooldownError, InsufficientGoldError
from core.services.habits import (
    HabitsService,
    DailiesService,
    RewardsService,
    UserStatsService,
    HabitsCronService,
)

router = APIRouter(tags=["habits"])

TG_LINK_ERROR = {
    "error": "tg_link_required",
    "message": "Для этого действия нужно связать Telegram-аккаунт",
}


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
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        return JSONResponse(status_code=403, content=TG_LINK_ERROR)
    if payload.area_id is None and payload.project_id is None:
        raise HTTPException(status_code=400, detail="area_or_project_required")
    try:
        async with HabitsService() as svc:
            hid = await svc.create_habit(
                owner_id=owner.owner_id,
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
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        return JSONResponse(status_code=403, content=TG_LINK_ERROR)
    try:
        async with HabitsService() as svc:
            res = await svc.up(habit_id, owner_id=owner.owner_id)
    except CooldownError as e:
        raise HTTPException(
            status_code=429,
            detail={"error": "cooldown", "retry_after": e.retry_after},
            headers={"Retry-After": str(e.retry_after)},
        )
    except InsufficientGoldError:
        raise HTTPException(status_code=400, detail={"error": "insufficient_gold"})
    except ValueError as exc:
        if str(exc) == "cooldown":
            raise HTTPException(
                status_code=429,
                detail={"error": "cooldown", "retry_after": 0},
                headers={"Retry-After": "0"},
            )
        raise HTTPException(status_code=400, detail={"error": str(exc)})
    if res is None:
        raise HTTPException(status_code=404)
    return res


@router.post("/habits/{habit_id}/down")
async def api_habit_down(
    habit_id: int,
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        return JSONResponse(status_code=403, content=TG_LINK_ERROR)
    try:
        async with HabitsService() as svc:
            res = await svc.down(habit_id, owner_id=owner.owner_id)
    except CooldownError as e:
        raise HTTPException(
            status_code=429,
            detail={"error": "cooldown", "retry_after": e.retry_after},
            headers={"Retry-After": str(e.retry_after)},
        )
    except ValueError as exc:
        if str(exc) == "cooldown":
            raise HTTPException(
                status_code=429,
                detail={"error": "cooldown", "retry_after": 0},
                headers={"Retry-After": "0"},
            )
        raise HTTPException(status_code=400, detail={"error": str(exc)})
    if res is None:
        raise HTTPException(status_code=404)
    return res


@router.get("/habits/stats")
async def api_stats(owner: OwnerCtx | None = Depends(get_current_owner)):
    if owner is None:
        raise HTTPException(status_code=401)
    async with UserStatsService() as svc:
        stats = await svc.get_or_create(owner.owner_id)
    stats.pop("owner_id", None)
    return stats


@router.post("/habits/cron/run")
async def api_cron_run(owner: OwnerCtx | None = Depends(get_current_owner)):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        return JSONResponse(status_code=403, content=TG_LINK_ERROR)
    async with HabitsCronService() as svc:
        ran = await svc.run(owner.owner_id)
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
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        return JSONResponse(status_code=403, content=TG_LINK_ERROR)
    if payload.area_id is None and payload.project_id is None:
        raise HTTPException(status_code=400, detail="area_or_project_required")
    try:
        async with DailiesService() as svc:
            did = await svc.create_daily(
                owner_id=owner.owner_id,
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
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        return JSONResponse(status_code=403, content=TG_LINK_ERROR)
    on = payload.date if payload else None
    async with DailiesService() as svc:
        ok = await svc.done(daily_id, owner_id=owner.owner_id, on=on)
    if not ok:
        raise HTTPException(status_code=404)
    return {"ok": True}


@router.post("/dailies/{daily_id}/undo")
async def api_daily_undo(
    daily_id: int,
    payload: DatePayload = Body(default=None),
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        return JSONResponse(status_code=403, content=TG_LINK_ERROR)
    on = payload.date if payload else None
    async with DailiesService() as svc:
        ok = await svc.undo(daily_id, owner_id=owner.owner_id, on=on)
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
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        return JSONResponse(status_code=403, content=TG_LINK_ERROR)
    if payload.area_id is None and payload.project_id is None:
        raise HTTPException(status_code=400, detail="area_or_project_required")
    try:
        async with RewardsService() as svc:
            rid = await svc.create(
                owner_id=owner.owner_id,
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
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    async with RewardsService() as svc:
        rewards = await svc.list(owner.owner_id)
    return rewards


@router.post("/rewards/{reward_id}/buy")
async def api_buy_reward(
    reward_id: int,
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        return JSONResponse(status_code=403, content=TG_LINK_ERROR)
    try:
        async with RewardsService() as svc:
            gold_after = await svc.buy(reward_id, owner_id=owner.owner_id)
    except InsufficientGoldError:
        return JSONResponse(
            status_code=400, content={"error": "insufficient_gold"}
        )
    if gold_after is None:
        raise HTTPException(status_code=404)
    return {"gold_after": gold_after}


# Alias for router include
api = router
