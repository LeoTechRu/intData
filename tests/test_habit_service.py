import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

import core.db as db
from base import Base
from core.services.nexus_service import HabitService


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

    async with HabitService() as svc:
        habits = await svc.list_habits(owner_id=123)
        assert len(habits) == 1
        assert habits[0].name == "Water"

    # Toggle today's progress and verify it is stored
    from datetime import date

    async with HabitService() as svc:
        updated = await svc.toggle_progress(h.id, date.today())
        assert updated is not None
        # progress stored as mapping of ISO date -> bool
        assert isinstance(updated.progress, dict)
        iso = date.today().isoformat()
        assert updated.progress.get(iso) is True

