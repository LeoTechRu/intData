import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
import core.db as db
from core.services.area_service import AreaService


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine('sqlite+aiosqlite:///:memory:?cache=shared')
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    db.engine = engine
    db.async_session = async_session
    try:
        yield async_session
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_area_create_move_subtree(session):
    async with AreaService() as svc:
        a_health = await svc.create_area(owner_id=1, name='Здоровье')
        assert a_health.depth == 0
        a_fitness = await svc.create_area(owner_id=1, name='Фитнес', parent_id=a_health.id)
        a_sleep = await svc.create_area(owner_id=1, name='Сон', parent_id=a_health.id)
        a_strength = await svc.create_area(owner_id=1, name='Силовые', parent_id=a_fitness.id)
        sub = await svc.list_subtree(a_health.id)
        ids = {a.id for a in sub}
        assert {a_health.id, a_fitness.id, a_sleep.id, a_strength.id} <= ids
        await svc.move_area(a_fitness.id, a_sleep.id)
        mf = await svc.get(a_fitness.id)
        ms = await svc.get(a_strength.id)
        assert mf.parent_id == a_sleep.id
        assert ms.depth == mf.depth + 1
