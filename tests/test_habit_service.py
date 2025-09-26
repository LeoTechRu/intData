import pytest
import pytest_asyncio
import sqlalchemy as sa
from datetime import date

from backend.services.habits import (
    DailiesService,
    HabitsCronService,
    HabitsService,
    dailies,
    habits,
)
from backend.services.nexus_service import HabitService
from backend.models import Area, Project, Habit as HabitModel, TgUser
from tests.utils.seeds import ensure_tg_user, ensure_web_user


@pytest_asyncio.fixture
async def session_factory(postgres_db):
    engine, async_session = postgres_db
    return async_session


@pytest.mark.asyncio
async def test_habit_up_down_and_para(session_factory, monkeypatch):
    from backend.config import config
    monkeypatch.setattr(config, "HABITS_ANTIFARM_ENABLED", True)
    monkeypatch.setattr(config, "HABITS_RPG_ENABLED", False)
    async with HabitsService() as svc:
        owner_id = 1
        await ensure_tg_user(svc.session, owner_id, first_name="Owner")
        await ensure_web_user(svc.session, user_id=owner_id, username="owner", password_hash="x", role="single")
        area = Area(owner_id=owner_id, name="A", title="A")
        svc.session.add(area)
        await svc.session.flush()
        project = Project(owner_id=owner_id, area_id=area.id, name="P")
        svc.session.add(project)
        await svc.session.flush()
        hid = await svc.create_habit(
            owner_id=owner_id,
            title="Test",
            type="positive",
            difficulty="easy",
            project_id=project.id,
        )
        await svc.session.execute(
            sa.update(habits).where(habits.c.id == hid).values(cooldown_sec=0)
        )
        habit = await svc.get(hid)
        assert habit["area_id"] == area.id
        res = await svc.up(hid, owner_id=owner_id)
        assert res is not None and res["xp"] > 0 and res["gold"] > 0
        res2 = await svc.down(hid, owner_id=owner_id)
        assert res2 is not None and res2["hp_delta"] < 0
        assert res2["new_val"] < res["new_val"]


@pytest.mark.asyncio
async def test_antifarm_decay_and_limit(session_factory, monkeypatch):
    from backend.config import config
    monkeypatch.setattr(config, "HABITS_ANTIFARM_ENABLED", True)
    monkeypatch.setattr(config, "HABITS_RPG_ENABLED", False)
    async with HabitsService() as svc:
        owner_id = 5
        await ensure_tg_user(svc.session, owner_id, first_name="Farm")
        await ensure_web_user(
            svc.session,
            user_id=owner_id,
            username="farm",
            password_hash="x",
            role="single",
        )
        area = Area(owner_id=owner_id, name="A", title="A")
        svc.session.add(area)
        await svc.session.flush()
        hid = await svc.create_habit(
            owner_id=owner_id,
            title="Farm",
            type="positive",
            difficulty="easy",
            area_id=area.id,
        )
        await svc.session.execute(
            sa.update(habits)
            .where(habits.c.id == hid)
            .values(cooldown_sec=0, daily_limit=2)
        )

        rewards = []
        for _ in range(4):
            res = await svc.up(hid, owner_id=owner_id)
            rewards.append((res["xp"], res["gold"]))
    assert rewards[0][0] >= rewards[1][0] >= rewards[2][0] >= rewards[3][0]
    assert rewards[0][1] >= rewards[1][1] >= rewards[2][1] >= rewards[3][1]


@pytest.mark.asyncio
async def test_cooldown_enforced(session_factory, monkeypatch):
    from backend.config import config
    monkeypatch.setattr(config, "HABITS_ANTIFARM_ENABLED", True)
    async with HabitsService() as svc:
        owner_id = 6
        await ensure_tg_user(svc.session, owner_id, first_name="Cooldown")
        await ensure_web_user(svc.session, user_id=owner_id, username="cooldown", password_hash="x", role="single")
        area = Area(owner_id=owner_id, name="A", title="A")
        svc.session.add(area)
        await svc.session.flush()
        hid = await svc.create_habit(
            owner_id=owner_id,
            title="CD",
            type="positive",
            difficulty="easy",
            area_id=area.id,
        )
        await svc.up(hid, owner_id=owner_id)
        from backend.services.errors import CooldownError
        with pytest.raises(CooldownError):
            await svc.up(hid, owner_id=owner_id)


@pytest.mark.asyncio
async def test_negative_bypass_limit(session_factory, monkeypatch):
    from backend.config import config
    monkeypatch.setattr(config, "HABITS_ANTIFARM_ENABLED", True)
    async with HabitsService() as svc:
        owner_id = 7
        await ensure_tg_user(svc.session, owner_id, first_name="Neg")
        await ensure_web_user(svc.session, user_id=owner_id, username="neg", password_hash="x", role="single")
        area = Area(owner_id=owner_id, name="A", title="A")
        svc.session.add(area)
        await svc.session.flush()
        hid = await svc.create_habit(
            owner_id=owner_id,
            title="Neg",
            type="positive",
            difficulty="easy",
            area_id=area.id,
        )
        await svc.session.execute(
            sa.update(habits)
            .where(habits.c.id == hid)
            .values(daily_limit=1, cooldown_sec=0)
        )
        await svc.up(hid, owner_id=owner_id)
        await svc.up(hid, owner_id=owner_id)
        res = await svc.down(hid, owner_id=owner_id)
        assert res["hp_delta"] < 0


@pytest.mark.asyncio
async def test_dailies_done_undo_streak(session_factory):
    async with DailiesService() as svc:
        owner_id = 2
        await ensure_tg_user(svc.session, owner_id, first_name="Daily")
        await ensure_web_user(svc.session, user_id=owner_id, username="daily", password_hash="x", role="single")
        area = Area(owner_id=owner_id, name="B", title="B")
        svc.session.add(area)
        await svc.session.flush()
        did = await svc.create_daily(
            owner_id=owner_id,
            title="Daily",
            rrule="FREQ=DAILY",
            difficulty="easy",
            area_id=area.id,
        )
        assert await svc.done(did, owner_id=owner_id, on=date(2025, 1, 1)) is True
        row = await svc.session.execute(
            sa.select(dailies.c.streak).where(dailies.c.id == did)
        )
        assert row.scalar_one() == 1
        assert await svc.done(did, owner_id=owner_id, on=date(2025, 1, 2)) is True
        row = await svc.session.execute(
            sa.select(dailies.c.streak).where(dailies.c.id == did)
        )
        assert row.scalar_one() == 2
        assert await svc.undo(did, owner_id=owner_id, on=date(2025, 1, 2)) is True
        row = await svc.session.execute(
            sa.select(dailies.c.streak).where(dailies.c.id == did)
        )
        assert row.scalar_one() == 1


@pytest.mark.asyncio
async def test_cron_idempotence(session_factory):
    async with HabitsCronService() as cron:
        owner_web = await ensure_web_user(cron.session, user_id=3, username="cron", role="single", password_hash="x")
        await cron.stats.apply(owner_web.id, xp=5, gold=5)
        ran = await cron.run(owner_web.id, today=date(2025, 1, 1))
        assert ran is True
        stats = await cron.stats.get_or_create(owner_web.id)
        assert stats["last_cron"] == date(2025, 1, 1)
        assert stats["daily_xp"] == 0 and stats["daily_gold"] == 0
        ran2 = await cron.run(owner_web.id, today=date(2025, 1, 1))
        assert ran2 is False


@pytest.mark.asyncio
async def test_list_habits_preloads_area_project(postgres_db):
    engine, async_session = postgres_db
    async with HabitService() as svc:
        owner_id = 4
        await ensure_tg_user(svc.session, owner_id, first_name="tg4")
        await ensure_web_user(svc.session, user_id=owner_id, username="u4", password_hash="x", role="single")
        area = Area(owner_id=owner_id, name="A", title="A")
        svc.session.add(area)
        await svc.session.flush()
        project = Project(owner_id=owner_id, area_id=area.id, name="P")
        svc.session.add(project)
        await svc.session.flush()
        svc.session.add(
            HabitModel(
                owner_id=owner_id,
                area_id=area.id,
                project_id=project.id,
                title="H",
                type="positive",
                difficulty="easy",
                frequency="daily",
            )
        )
        await svc.session.flush()
        habits = await svc.list_habits(owner_id=owner_id)
        assert len(habits) == 1
        habit = habits[0]
        from sqlalchemy import inspect

        assert habit.area.id == area.id
        assert habit.project.id == project.id
        assert "area" not in inspect(habit).unloaded
        assert "project" not in inspect(habit).unloaded
