import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
import core.db as db
from core.models import TgUser
from core.services.area_service import AreaService
from core.services.para_service import ParaService
from core.services.task_service import TaskService

try:
    from main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from main import app  # type: ignore


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine('sqlite+aiosqlite:///:memory:?cache=shared')
    async_session = sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    db.engine = engine
    db.async_session = async_session
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    await engine.dispose()


async def _create_tg_user(telegram_id: int = 1) -> int:
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            tg = TgUser(telegram_id=telegram_id, first_name="tg")
            session.add(tg)
    return telegram_id


@pytest.mark.asyncio
async def test_tasks_include_subtree(client: AsyncClient):
    owner = await _create_tg_user(telegram_id=101)
    cookies = {"telegram_id": str(owner)}

    # Build Areas tree: Health -> Fitness -> Strength; Health -> Sleep
    async with AreaService() as asvc:
        health = await asvc.create_area(owner_id=owner, name='Health')
        fitness = await asvc.create_area(owner_id=owner, name='Fitness', parent_id=health.id)
        sleep = await asvc.create_area(owner_id=owner, name='Sleep', parent_id=health.id)
        strength = await asvc.create_area(owner_id=owner, name='Strength', parent_id=fitness.id)

    # Create Projects at leaf
    async with ParaService() as psvc:
        p1 = await psvc.create_project(owner_id=owner, name='Gym', area_id=strength.id)
        p2 = await psvc.create_project(owner_id=owner, name='Sleep hygiene', area_id=sleep.id)

    # Create Tasks linked to projects
    async with TaskService() as tsvc:
        await tsvc.create_task(owner_id=owner, title='Squats', project_id=p1.id)
        await tsvc.create_task(owner_id=owner, title='Lights off', project_id=p2.id)

    # Filter by Health including subtree → should return both tasks
    resp = await client.get(f"/api/tasks?area_id={health.id}&include_sub=1", cookies=cookies)
    assert resp.status_code == 200
    tasks = [t['title'] for t in resp.json()]
    assert 'Squats' in tasks and 'Lights off' in tasks
