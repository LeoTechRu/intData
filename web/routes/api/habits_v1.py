from datetime import date, datetime
from typing import Optional, Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Response, Query
from pydantic import BaseModel, Field

from core.auth.owner import OwnerCtx, get_current_owner
from core.services.errors import CooldownError, InsufficientGoldError
from core.services.habits import (
    HabitsService,
    DailiesService,
    RewardsService,
    UserStatsService,
    HabitsCronService,
    HabitsDashboardService,
    habits,
)
from core.services.nexus_service import HabitService
from sqlalchemy import select

router = APIRouter()

TG_LINK_ERROR = {
    "error": "tg_link_required",
    "message": "Для этого действия нужно связать Telegram-аккаунт",
}


class TgLinkRequiredError(BaseModel):
    error: Literal["tg_link_required"]
    message: str


class CooldownErrorOut(BaseModel):
    error: Literal["cooldown"]
    retry_after: int


TG_RESP = {403: {"model": TgLinkRequiredError, "description": "Telegram link required"}}
COOLDOWN_RESP = {
    429: {
        "model": CooldownErrorOut,
        "description": "Cooldown active",
        "headers": {
            "Retry-After": {
                "description": "Seconds to wait before retry",
                "schema": {"type": "integer"},
            }
        },
    }
}


class StatsOut(BaseModel):
    level: int
    xp: int
    gold: int
    hp: int
    kp: int
    daily_xp: int
    daily_gold: int


class HabitDashboardHabit(BaseModel):
    id: int
    name: Optional[str] = None
    title: Optional[str] = None
    type: Optional[str] = None
    difficulty: Optional[str] = None
    frequency: str
    note: Optional[str] = None
    area_id: Optional[int] = None
    project_id: Optional[int] = None
    progress: list[str] = Field(default_factory=list)
    created_at: Optional[str] = None


class HabitDashboardDaily(BaseModel):
    id: int
    title: str
    note: Optional[str] = None
    rrule: str
    difficulty: Optional[str] = None
    streak: int = 0
    frozen: bool = False
    area_id: Optional[int] = None
    project_id: Optional[int] = None
    created_at: Optional[str] = None


class HabitDashboardReward(BaseModel):
    id: int
    title: str
    cost_gold: int
    area_id: Optional[int] = None
    project_id: Optional[int] = None
    created_at: Optional[str] = None


class HabitDashboardResponse(BaseModel):
    habits: list[HabitDashboardHabit] = Field(default_factory=list)
    dailies: list[HabitDashboardDaily] = Field(default_factory=list)
    rewards: list[HabitDashboardReward] = Field(default_factory=list)
    stats: StatsOut


# ----------------------- Habits -----------------------


class HabitIn(BaseModel):
    title: str = Field(..., alias="name")
    type: str = "positive"
    difficulty: str = "easy"
    frequency: Literal["daily", "weekly", "monthly"] = "daily"
    note: Optional[str] = None
    area_id: Optional[int] = None
    project_id: Optional[int] = None

    class Config:
        populate_by_name = True


class HabitUpdate(BaseModel):
    title: Optional[str] = Field(None, alias="name")
    frequency: Optional[Literal["daily", "weekly", "monthly"]] = None
    note: Optional[str] = None

    class Config:
        populate_by_name = True


@router.get("/habits", tags=["Habits"])
async def api_list_habits(owner: OwnerCtx | None = Depends(get_current_owner)):
    if owner is None:
        raise HTTPException(status_code=401)
    async with HabitsService() as svc:
        res = await svc.session.execute(
            select(habits).where(habits.c.owner_id == owner.owner_id)
        )
        payload = []
        for row in res.mappings().all():
            progress_dict = row.get("progress") or {}
            completed = [
                day
                for day, done in progress_dict.items()
                if isinstance(done, bool) and done
            ]
            created = row.get("created_at")
            payload.append(
                {
                    "id": row["id"],
                    "name": row["title"],
                    "title": row["title"],
                    "type": row["type"],
                    "difficulty": row["difficulty"],
                    "frequency": row.get("frequency", "daily"),
                    "note": row.get("note"),
                    "area_id": row.get("area_id"),
                    "project_id": row.get("project_id"),
                    "progress": completed,
                    "created_at": created.isoformat() if isinstance(created, datetime) else created,
                }
            )
        return payload


@router.post("/habits", tags=["Habits"], status_code=201, responses=TG_RESP)
async def api_create_habit(
    payload: HabitIn,
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        raise HTTPException(status_code=403, detail=TG_LINK_ERROR)
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
                frequency=payload.frequency,
            )
    except ValueError as exc:
        detail = "area_or_project_required"
        if str(exc) == "invalid_frequency":
            detail = "invalid_frequency"
        raise HTTPException(status_code=400, detail=detail)
    return {"id": hid}


class DatePayload(BaseModel):
    date: Optional[date] = None


@router.patch("/habits/{habit_id}", tags=["Habits"], responses=TG_RESP)
async def api_update_habit(
    habit_id: int,
    payload: HabitUpdate,
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        raise HTTPException(status_code=403, detail=TG_LINK_ERROR)
    try:
        async with HabitsService() as svc:
            updated = await svc.update_habit(
                habit_id,
                owner_id=owner.owner_id,
                title=payload.title,
                note=payload.note,
                frequency=payload.frequency,
            )
    except ValueError as exc:
        detail = {"error": str(exc)}
        if str(exc) == "invalid_frequency":
            detail = {"error": "invalid_frequency"}
        raise HTTPException(status_code=400, detail=detail)
    if not updated:
        raise HTTPException(status_code=404)
    return {"status": "ok"}


@router.delete("/habits/{habit_id}", tags=["Habits"], status_code=204, responses=TG_RESP)
async def api_delete_habit(
    habit_id: int,
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        raise HTTPException(status_code=403, detail=TG_LINK_ERROR)
    async with HabitsService() as svc:
        deleted = await svc.delete_habit(habit_id, owner_id=owner.owner_id)
    if not deleted:
        raise HTTPException(status_code=404)
    return Response(status_code=204)


@router.post(
    "/habits/{habit_id}/toggle",
    tags=["Habits"],
    responses={**TG_RESP, **COOLDOWN_RESP},
)
async def api_habit_toggle(
    habit_id: int,
    payload: DatePayload | None = Body(default=None),
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        raise HTTPException(status_code=403, detail=TG_LINK_ERROR)
    target_day = (payload.date if payload else None) or date.today()
    if target_day > date.today():
        raise HTTPException(status_code=400, detail={"error": "future_date_not_allowed"})
    async with HabitService() as svc:
        habit = await svc.get(habit_id)
        if habit is None or habit.owner_id != owner.owner_id:
            raise HTTPException(status_code=404)
        try:
            updated = await svc.toggle_progress(habit_id, target_day)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)})
    if updated is None:
        raise HTTPException(status_code=404)
    progress_dict = updated.progress or {}
    completed = [
        day
        for day, done in progress_dict.items()
        if isinstance(done, bool) and done
    ]
    return {"id": updated.id, "progress": completed}


@router.post(
    "/habits/{habit_id}/up",
    tags=["Habits"],
    responses={**TG_RESP, **COOLDOWN_RESP},
)
async def api_habit_up(
    habit_id: int,
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        raise HTTPException(status_code=403, detail=TG_LINK_ERROR)
    try:
        async with HabitsService() as svc:
            res = await svc.up(habit_id, owner_id=owner.owner_id)
    except CooldownError as e:
        raise HTTPException(
            status_code=429,
            detail={"error": "cooldown", "retry_after": e.seconds},
            headers={"Retry-After": str(e.seconds)},
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


@router.post(
    "/habits/{habit_id}/down",
    tags=["Habits"],
    responses={**TG_RESP, **COOLDOWN_RESP},
)
async def api_habit_down(
    habit_id: int,
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        raise HTTPException(status_code=403, detail=TG_LINK_ERROR)
    try:
        async with HabitsService() as svc:
            res = await svc.down(habit_id, owner_id=owner.owner_id)
    except CooldownError as e:
        raise HTTPException(
            status_code=429,
            detail={"error": "cooldown", "retry_after": e.seconds},
            headers={"Retry-After": str(e.seconds)},
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


@router.get(
    "/habits/dashboard",
    tags=["Habits"],
    response_model=HabitDashboardResponse,
)
async def api_habits_dashboard(
    owner: OwnerCtx | None = Depends(get_current_owner),
    area_id: int | None = Query(default=None),
    project_id: int | None = Query(default=None),
    include_sub: int | None = Query(default=0),
):
    if owner is None:
        raise HTTPException(status_code=401)
    async with HabitsDashboardService() as svc:
        payload = await svc.fetch_dashboard(
            owner.owner_id,
            area_id=area_id,
            project_id=project_id,
            include_sub=bool(include_sub),
        )
    return payload


@router.get("/habits/stats", tags=["Habits"], response_model=StatsOut)
async def api_stats(owner: OwnerCtx | None = Depends(get_current_owner)):
    if owner is None:
        raise HTTPException(status_code=401)
    async with UserStatsService() as svc:
        stats = await svc.get_or_create(owner.owner_id)
    stats.pop("owner_id", None)
    return StatsOut(**stats)


@router.post("/habits/cron/run", tags=["Habits"], responses=TG_RESP)
async def api_cron_run(owner: OwnerCtx | None = Depends(get_current_owner)):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        raise HTTPException(status_code=403, detail=TG_LINK_ERROR)
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


@router.post("/dailies", tags=["Habits"], status_code=201, responses=TG_RESP)
async def api_create_daily(
    payload: DailyIn,
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        raise HTTPException(status_code=403, detail=TG_LINK_ERROR)
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


@router.post(
    "/dailies/{daily_id}/done",
    tags=["Habits"],
    responses=TG_RESP,
)
async def api_daily_done(
    daily_id: int,
    payload: DatePayload = Body(default=None),
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        raise HTTPException(status_code=403, detail=TG_LINK_ERROR)
    on = payload.date if payload else None
    async with DailiesService() as svc:
        ok = await svc.done(daily_id, owner_id=owner.owner_id, on=on)
    if not ok:
        raise HTTPException(status_code=404)
    return {"ok": True}


@router.post(
    "/dailies/{daily_id}/undo",
    tags=["Habits"],
    responses=TG_RESP,
)
async def api_daily_undo(
    daily_id: int,
    payload: DatePayload = Body(default=None),
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        raise HTTPException(status_code=403, detail=TG_LINK_ERROR)
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


@router.post("/rewards", tags=["Habits"], status_code=201, responses=TG_RESP)
async def api_create_reward(
    payload: RewardIn,
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        raise HTTPException(status_code=403, detail=TG_LINK_ERROR)
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


@router.get("/rewards", tags=["Habits"])
async def api_list_rewards(
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    async with RewardsService() as svc:
        rewards = await svc.list(owner.owner_id)
    return rewards


@router.post(
    "/rewards/{reward_id}/buy",
    tags=["Habits"],
    responses=TG_RESP,
)
async def api_buy_reward(
    reward_id: int,
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=401)
    if not owner.has_tg:
        raise HTTPException(status_code=403, detail=TG_LINK_ERROR)
    try:
        async with RewardsService() as svc:
            gold_after = await svc.buy(reward_id, owner_id=owner.owner_id)
    except InsufficientGoldError:
        raise HTTPException(
            status_code=400, detail={"error": "insufficient_gold"}
        )
    if gold_after is None:
        raise HTTPException(status_code=404)
    return {"gold_after": gold_after}


# Alias for router include
api = router
