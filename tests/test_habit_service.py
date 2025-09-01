import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

import core.db as db
from base import Base
from core.services.nexus_service import HabitService
from core.models import Area, Project


@pytest_asyncio.fixture
async def session_maker():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    db.async_session = async_session
    try:
        yield async_session
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_habit_crud_and_toggle(session_maker):
    async with HabitService() as svc:
        h = await svc.create_habit(owner_id=123, name="Water", frequency="daily")
        assert h.id is not None
        inbox = await svc.session.get(Area, h.area_id)
        assert inbox is not None and inbox.name == "Входящие"
        area = Area(owner_id=123, name="Health", title="Health")
        svc.session.add(area)
        await svc.session.flush()
        project = Project(owner_id=123, area_id=area.id, name="Fitness")
        svc.session.add(project)
        await svc.session.flush()
        h2 = await svc.create_habit(
            owner_id=123,
            name="Run",
            frequency="daily",
            project_id=project.id,
        )
        assert h2.project_id == project.id
        assert h2.area_id == area.id

    async with HabitService() as svc:
        habits = await svc.list_habits(owner_id=123)
        assert len(habits) == 2
        names = {habit.name for habit in habits}
        assert {"Water", "Run"} <= names

    # Toggle today's progress and verify it is stored
    from datetime import date

    async with HabitService() as svc:
        updated = await svc.toggle_progress(h.id, date.today())
        assert updated is not None
        # progress stored as mapping of ISO date -> bool
        assert isinstance(updated.progress, dict)
        iso = date.today().isoformat()
        assert updated.progress.get(iso) is True

