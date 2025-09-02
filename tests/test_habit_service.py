import pytest
import pytest_asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from datetime import date

import core.db as db
from core.services.habits import (
    DailiesService,
    HabitsCronService,
    HabitsService,
    metadata,
    dailies,
)
from core.services.nexus_service import HabitService
from core.models import Base, WebUser, Area, Project, Habit as HabitModel


@pytest_asyncio.fixture
async def session_maker():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.exec_driver_sql("CREATE TABLE users_web (id INTEGER PRIMARY KEY)")
        await conn.exec_driver_sql(
            "CREATE TABLE areas (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER, title TEXT)"
        )
        await conn.exec_driver_sql(
            "CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER, area_id INTEGER)"
        )
        await conn.run_sync(metadata.create_all)
    db.async_session = async_session
    try:
        yield async_session
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_habit_up_down_and_para(session_maker):
    async with HabitsService() as svc:
        await svc.session.execute(sa.text("INSERT INTO users_web (id) VALUES (1)"))
        await svc.session.execute(
            sa.text("INSERT INTO areas (id, owner_id, title) VALUES (1,1,'A')")
        )
        await svc.session.execute(
            sa.text("INSERT INTO projects (id, owner_id, area_id) VALUES (1,1,1)")
        )
        hid = await svc.create_habit(
            owner_id=1,
            title="Test",
            type="positive",
            difficulty="easy",
            project_id=1,
        )
        habit = await svc.get(hid)
        assert habit["area_id"] == 1
        res = await svc.up(hid, owner_id=1)
        assert res is not None and res["xp"] > 0 and res["gold"] > 0
        res2 = await svc.down(hid, owner_id=1)
        assert res2 is not None and res2["hp_delta"] < 0
        assert res2["new_val"] < res["new_val"]


@pytest.mark.asyncio
async def test_dailies_done_undo_streak(session_maker):
    async with DailiesService() as svc:
        await svc.session.execute(sa.text("INSERT INTO users_web (id) VALUES (2)"))
        await svc.session.execute(
            sa.text("INSERT INTO areas (id, owner_id, title) VALUES (2,2,'B')")
        )
        did = await svc.create_daily(
            owner_id=2,
            title="Daily",
            rrule="FREQ=DAILY",
            difficulty="easy",
            area_id=2,
        )
        assert await svc.done(did, owner_id=2, on=date(2025, 1, 1)) is True
        row = await svc.session.execute(
            sa.select(dailies.c.streak).where(dailies.c.id == did)
        )
        assert row.scalar_one() == 1
        assert await svc.done(did, owner_id=2, on=date(2025, 1, 2)) is True
        row = await svc.session.execute(
            sa.select(dailies.c.streak).where(dailies.c.id == did)
        )
        assert row.scalar_one() == 2
        assert await svc.undo(did, owner_id=2, on=date(2025, 1, 2)) is True
        row = await svc.session.execute(
            sa.select(dailies.c.streak).where(dailies.c.id == did)
        )
        assert row.scalar_one() == 1


@pytest.mark.asyncio
async def test_cron_idempotence(session_maker):
    async with HabitsCronService() as cron:
        await cron.session.execute(sa.text("INSERT INTO users_web (id) VALUES (3)"))
        ran = await cron.run(3, today=date(2025, 1, 1))
        assert ran is True
        stats = await cron.stats.get_or_create(3)
        assert stats["last_cron"] == date(2025, 1, 1)
        ran2 = await cron.run(3, today=date(2025, 1, 1))
        assert ran2 is False


@pytest.mark.asyncio
async def test_list_habits_preloads_area_project():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(
            Base.metadata.create_all,
            tables=[
                WebUser.__table__,
                Area.__table__,
                Project.__table__,
                HabitModel.__table__,
            ],
        )
    db.async_session = async_session
    async with HabitService() as svc:
        await svc.session.execute(sa.insert(WebUser).values(id=4, username="u4"))
        await svc.session.execute(
            sa.insert(Area).values(id=4, owner_id=4, name="A", title="A")
        )
        await svc.session.execute(
            sa.insert(Project).values(id=4, owner_id=4, area_id=4, name="P")
        )
        svc.session.add(
            HabitModel(
                owner_id=4,
                area_id=4,
                project_id=4,
                title="H",
                type="positive",
                difficulty="easy",
            )
        )
        await svc.session.flush()
        habits = await svc.list_habits(owner_id=4)
        assert len(habits) == 1
        habit = habits[0]
        from sqlalchemy import inspect

        assert habit.area.id == 4
        assert habit.project.id == 4
        assert "area" not in inspect(habit).unloaded
        assert "project" not in inspect(habit).unloaded
    await engine.dispose()
