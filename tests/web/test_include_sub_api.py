import pytest
import pytest_asyncio
from httpx import AsyncClient

from base import Base
import core.db as db
from core.services.area_service import AreaService
from core.services.para_service import ParaService
from core.services.task_service import TaskService
from core.services.note_service import NoteService
from tests.utils.seeds import ensure_tg_user

try:
    from main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from main import app  # type: ignore


@pytest_asyncio.fixture
async def client(postgres_db):
    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


async def _create_tg_user(telegram_id: int = 1) -> int:
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            await ensure_tg_user(session, telegram_id, first_name="tg")
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
    resp = await client.get(f"/api/v1/tasks?area_id={health.id}&include_sub=1", cookies=cookies)
    assert resp.status_code == 200
    tasks = [t['title'] for t in resp.json()]
    assert 'Squats' in tasks and 'Lights off' in tasks


@pytest.mark.asyncio
async def test_notes_include_subtree(client: AsyncClient):
    owner = await _create_tg_user(telegram_id=102)
    cookies = {"telegram_id": str(owner)}

    async with AreaService() as asvc:
        health = await asvc.create_area(owner_id=owner, name='Health')
        fitness = await asvc.create_area(owner_id=owner, name='Fitness', parent_id=health.id)
        sleep = await asvc.create_area(owner_id=owner, name='Sleep', parent_id=health.id)
        strength = await asvc.create_area(owner_id=owner, name='Strength', parent_id=fitness.id)

    async with NoteService() as nsvc:
        await nsvc.create_note(owner_id=owner, content='Gym note', area_id=strength.id)
        await nsvc.create_note(owner_id=owner, content='Sleep note', area_id=sleep.id)

    resp = await client.get(f"/api/v1/notes?area_id={health.id}&include_sub=1", cookies=cookies)
    assert resp.status_code == 200
    titles = [n['title'] for n in resp.json()]
    assert any('Gym note' in t for t in titles) and any('Sleep note' in t for t in titles)
