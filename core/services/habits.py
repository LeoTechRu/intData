"""Habitica-like services for habits, dailies and user stats (E16)."""
from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any, Dict, Optional

import sqlalchemy as sa
from sqlalchemy import insert, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.config import config

# SQLite-friendly table metadata used by tests and services
metadata = sa.MetaData()

habits = sa.Table(
    "habits",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column("owner_id", sa.BigInteger, nullable=False),
    sa.Column("area_id", sa.Integer, nullable=False),
    sa.Column("project_id", sa.Integer),
    sa.Column("title", sa.String(255), nullable=False),
    sa.Column("note", sa.Text),
    sa.Column("type", sa.String(8), nullable=False),
    sa.Column("difficulty", sa.String(8), nullable=False),
    sa.Column("up_enabled", sa.Boolean, nullable=False, server_default=sa.true()),
    sa.Column("down_enabled", sa.Boolean, nullable=False, server_default=sa.true()),
    sa.Column("val", sa.Float, nullable=False, server_default="0"),
    sa.Column("tags", sa.JSON),
    sa.Column("archived_at", sa.DateTime(timezone=True)),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
)

habit_logs = sa.Table(
    "habit_logs",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column("habit_id", sa.Integer, sa.ForeignKey("habits.id", ondelete="CASCADE")),
    sa.Column("owner_id", sa.BigInteger),
    sa.Column("at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    sa.Column("delta", sa.Integer),
    sa.Column("reward_xp", sa.Integer),
    sa.Column("reward_gold", sa.Integer),
    sa.Column("penalty_hp", sa.Integer),
)


# Dailies

dailies = sa.Table(
    "dailies",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column("owner_id", sa.BigInteger, nullable=False),
    sa.Column("area_id", sa.Integer, nullable=False),
    sa.Column("project_id", sa.Integer),
    sa.Column("title", sa.String(255), nullable=False),
    sa.Column("note", sa.Text),
    sa.Column("rrule", sa.Text, nullable=False),
    sa.Column("difficulty", sa.String(8), nullable=False),
    sa.Column("streak", sa.Integer, nullable=False, server_default="0"),
    sa.Column("frozen", sa.Boolean, nullable=False, server_default=sa.false()),
    sa.Column("archived_at", sa.DateTime(timezone=True)),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
)

daily_logs = sa.Table(
    "daily_logs",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column("daily_id", sa.Integer, sa.ForeignKey("dailies.id", ondelete="CASCADE")),
    sa.Column("owner_id", sa.BigInteger),
    sa.Column("date", sa.Date, nullable=False),
    sa.Column("done", sa.Boolean, nullable=False),
    sa.Column("reward_xp", sa.Integer),
    sa.Column("reward_gold", sa.Integer),
    sa.Column("penalty_hp", sa.Integer),
    sa.UniqueConstraint("daily_id", "date", name="ux_daily_date"),
)


rewards = sa.Table(
    "rewards",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column("owner_id", sa.BigInteger, nullable=False),
    sa.Column("title", sa.String(255), nullable=False),
    sa.Column("cost_gold", sa.Integer, nullable=False),
    sa.Column("area_id", sa.Integer, nullable=False),
    sa.Column("project_id", sa.Integer),
    sa.Column("archived_at", sa.DateTime(timezone=True)),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
)

user_stats = sa.Table(
    "user_stats",
    metadata,
    sa.Column("owner_id", sa.BigInteger, primary_key=True),
    sa.Column("level", sa.Integer, nullable=False, server_default="1"),
    sa.Column("xp", sa.Integer, nullable=False, server_default="0"),
    sa.Column("gold", sa.Integer, nullable=False, server_default="0"),
    sa.Column("hp", sa.Integer, nullable=False, server_default="50"),
    sa.Column("kp", sa.BigInteger, nullable=False, server_default="0"),
    sa.Column("last_cron", sa.Date),
)


class UserStatsService:
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "UserStatsService":
        if self.session is None:
            self.session = db.async_session()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if not self._external:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
            await self.session.close()

    async def get_or_create(self, owner_id: int) -> Dict[str, Any]:
        stmt = select(user_stats).where(user_stats.c.owner_id == owner_id)
        res = await self.session.execute(stmt)
        row = res.mappings().first()
        if row:
            return dict(row)
        await self.session.execute(insert(user_stats).values(owner_id=owner_id))
        await self.session.flush()
        return {
            "owner_id": owner_id,
            "level": 1,
            "xp": 0,
            "gold": 0,
            "hp": config.HP_MAX,
            "kp": 0,
            "last_cron": None,
        }

    @staticmethod
    def level_xp(level: int) -> int:
        return 100 + (level - 1) * 50

    async def apply(
        self,
        owner_id: int,
        *,
        xp: int = 0,
        gold: int = 0,
        hp_delta: int = 0,
        kp: int = 0,
    ) -> Dict[str, Any]:
        stats = await self.get_or_create(owner_id)
        level = stats["level"]
        xp_total = stats["xp"] + xp
        gold_total = stats["gold"] + gold
        hp_total = stats["hp"] + hp_delta
        kp_total = stats["kp"] + kp
        while xp_total >= self.level_xp(level):
            xp_total -= self.level_xp(level)
            level += 1
            hp_total = config.HP_MAX
        await self.session.execute(
            update(user_stats)
            .where(user_stats.c.owner_id == owner_id)
            .values(level=level, xp=xp_total, gold=gold_total, hp=hp_total, kp=kp_total)
        )
        await self.session.flush()
        return {
            "level": level,
            "xp": xp_total,
            "gold": gold_total,
            "hp": hp_total,
            "kp": kp_total,
        }


class HabitsService:
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None
        self.stats = UserStatsService(session)

    async def __aenter__(self) -> "HabitsService":
        if self.session is None:
            self.session = db.async_session()
            self.stats.session = self.session
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if not self._external:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
            await self.session.close()

    async def _resolve_area(
        self, owner_id: int, area_id: Optional[int], project_id: Optional[int]
    ) -> int:
        if project_id is not None:
            stmt = sa.text("SELECT area_id FROM projects WHERE id=:p")
            area = await self.session.execute(stmt, {"p": project_id})
            return area.scalar_one()
        if area_id is None:
            raise ValueError("area_id required")
        return area_id

    async def create_habit(
        self,
        *,
        owner_id: int,
        title: str,
        type: str,
        difficulty: str,
        area_id: Optional[int] = None,
        project_id: Optional[int] = None,
        note: str | None = None,
    ) -> int:
        area_id = await self._resolve_area(owner_id, area_id, project_id)
        stmt = (
            insert(habits)
            .values(
                owner_id=owner_id,
                area_id=area_id,
                project_id=project_id,
                title=title,
                note=note,
                type=type,
                difficulty=difficulty,
            )
            .returning(habits.c.id)
        )
        res = await self.session.execute(stmt)
        return res.scalar_one()

    async def get(self, habit_id: int) -> Optional[Dict[str, Any]]:
        res = await self.session.execute(select(habits).where(habits.c.id == habit_id))
        row = res.mappings().first()
        return dict(row) if row else None

    async def up(self, habit_id: int, *, owner_id: int) -> Optional[Dict[str, Any]]:
        habit = await self.get(habit_id)
        if not habit or habit["owner_id"] != owner_id or not habit["up_enabled"]:
            return None
        diff = habit["difficulty"]
        val = habit["val"]
        base_xp = config.XP_BASE[diff]
        base_gold = config.GOLD_BASE[diff]
        factor = 1.0
        if config.HABITS_RPG_ENABLED:
            factor = math.exp(-config.REWARD_DECAY_K * max(0.0, val))
        xp = int(base_xp * factor)
        gold = int(base_gold * factor)
        new_val = val + config.VAL_STEP
        await self.session.execute(
            update(habits).where(habits.c.id == habit_id).values(val=new_val)
        )
        await self.session.execute(
            insert(habit_logs).values(
                habit_id=habit_id,
                owner_id=owner_id,
                delta=1,
                reward_xp=xp,
                reward_gold=gold,
                penalty_hp=0,
            )
        )
        stats = await self.stats.apply(owner_id, xp=xp, gold=gold, kp=xp)
        return {
            "xp": xp,
            "gold": gold,
            "hp_delta": 0,
            "new_val": new_val,
            "new_stats": stats,
        }

    async def down(self, habit_id: int, *, owner_id: int) -> Optional[Dict[str, Any]]:
        habit = await self.get(habit_id)
        if not habit or habit["owner_id"] != owner_id or not habit["down_enabled"]:
            return None
        diff = habit["difficulty"]
        val = habit["val"]
        base_hp = config.HP_BASE[diff]
        hp = -base_hp
        new_val = val - config.VAL_STEP
        await self.session.execute(
            update(habits).where(habits.c.id == habit_id).values(val=new_val)
        )
        await self.session.execute(
            insert(habit_logs).values(
                habit_id=habit_id,
                owner_id=owner_id,
                delta=-1,
                reward_xp=0,
                reward_gold=0,
                penalty_hp=base_hp,
            )
        )
        stats = await self.stats.apply(owner_id, hp_delta=hp)
        return {
            "xp": 0,
            "gold": 0,
            "hp_delta": hp,
            "new_val": new_val,
            "new_stats": stats,
        }


class DailiesService:
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None
        self.stats = UserStatsService(session)

    async def __aenter__(self) -> "DailiesService":
        if self.session is None:
            self.session = db.async_session()
            self.stats.session = self.session
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if not self._external:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
            await self.session.close()

    async def _resolve_area(
        self, owner_id: int, area_id: Optional[int], project_id: Optional[int]
    ) -> int:
        if project_id is not None:
            stmt = sa.text("SELECT area_id FROM projects WHERE id=:p")
            area = await self.session.execute(stmt, {"p": project_id})
            return area.scalar_one()
        if area_id is None:
            raise ValueError("area_id required")
        return area_id

    async def create_daily(
        self,
        *,
        owner_id: int,
        title: str,
        rrule: str,
        difficulty: str,
        area_id: Optional[int] = None,
        project_id: Optional[int] = None,
        note: str | None = None,
    ) -> int:
        area_id = await self._resolve_area(owner_id, area_id, project_id)
        stmt = (
            insert(dailies)
            .values(
                owner_id=owner_id,
                area_id=area_id,
                project_id=project_id,
                title=title,
                note=note,
                rrule=rrule,
                difficulty=difficulty,
            )
            .returning(dailies.c.id)
        )
        res = await self.session.execute(stmt)
        return res.scalar_one()

    async def done(self, daily_id: int, *, owner_id: int, on: Optional[date] = None) -> bool:
        on = on or date.today()
        res = await self.session.execute(
            select(daily_logs).where(
                daily_logs.c.daily_id == daily_id, daily_logs.c.date == on
            )
        )
        if res.first():
            return False
        daily = await self.session.execute(
            select(dailies).where(dailies.c.id == daily_id)
        )
        row = daily.mappings().first()
        if not row or row["owner_id"] != owner_id:
            return False
        diff = row["difficulty"]
        xp = config.XP_BASE[diff]
        gold = config.GOLD_BASE[diff]
        await self.session.execute(
            insert(daily_logs).values(
                daily_id=daily_id,
                owner_id=owner_id,
                date=on,
                done=True,
                reward_xp=xp,
                reward_gold=gold,
            )
        )
        prev = on - timedelta(days=1)
        prev_done = await self.session.execute(
            select(daily_logs.c.id).where(
                daily_logs.c.daily_id == daily_id,
                daily_logs.c.date == prev,
                daily_logs.c.done == True,
            )
        )
        streak = row["streak"] + 1 if prev_done.first() else 1
        await self.session.execute(
            update(dailies).where(dailies.c.id == daily_id).values(streak=streak)
        )
        await self.stats.apply(owner_id, xp=xp, gold=gold, kp=xp)
        return True

    async def undo(self, daily_id: int, *, owner_id: int, on: Optional[date] = None) -> bool:
        on = on or date.today()
        res = await self.session.execute(
            select(daily_logs).where(
                daily_logs.c.daily_id == daily_id, daily_logs.c.date == on
            )
        )
        row = res.mappings().first()
        if not row or row["owner_id"] != owner_id:
            return False
        await self.session.execute(
            delete(daily_logs).where(daily_logs.c.id == row["id"])
        )
        daily = await self.session.execute(
            select(dailies).where(dailies.c.id == daily_id)
        )
        daily_row = daily.mappings().first()
        streak = max(0, (daily_row["streak"] or 0) - 1)
        await self.session.execute(
            update(dailies).where(dailies.c.id == daily_id).values(streak=streak)
        )
        await self.stats.apply(
            owner_id,
            xp=-row.get("reward_xp", 0),
            gold=-row.get("reward_gold", 0),
        )
        return True


class HabitsCronService:
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None
        self.stats = UserStatsService(session)

    async def __aenter__(self) -> "HabitsCronService":
        if self.session is None:
            self.session = db.async_session()
            self.stats.session = self.session
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if not self._external:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
            await self.session.close()

    async def run(self, owner_id: int, today: Optional[date] = None) -> bool:
        today = today or date.today()
        stats = await self.stats.get_or_create(owner_id)
        if stats["last_cron"] == today:
            return False
        await self.session.execute(
            update(user_stats)
            .where(user_stats.c.owner_id == owner_id)
            .values(last_cron=today)
        )
        await self.session.flush()
        return True
