import pytest
import pytest_asyncio
from httpx import AsyncClient

from base import Base
import core.db as db
from core.services.area_service import AreaService
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
async def test_task_time_summary_and_actions(client: AsyncClient):
    telegram_id = await _create_tg_user(telegram_id=33)
    cookies = {"telegram_id": str(telegram_id)}

    # Create area and task
    async with AreaService() as asvc:
        area = await asvc.create_area(owner_id=telegram_id, name="Inbox")
    resp = await client.post(
        "/api/v1/tasks",
        json={"title": "Tracked Task", "area_id": area.id},
        cookies=cookies,
    )
    assert resp.status_code == 201
    task_id = resp.json()["id"]

    # Start timer for task
    resp = await client.post(f"/api/v1/tasks/{task_id}/start_timer", cookies=cookies)
    assert resp.status_code == 200

    # List tasks -> running_entry_id should be present
    resp = await client.get("/api/v1/tasks", cookies=cookies)
    assert resp.status_code == 200
    task = [t for t in resp.json() if t["id"] == task_id][0]
    assert task["running_entry_id"] is not None

    # Stop via time stop endpoint
    entry_id = task["running_entry_id"]
    resp = await client.post(f"/api/v1/time/{entry_id}/stop", cookies=cookies)
    assert resp.status_code == 200

    # List tasks -> tracked_minutes >= 0 and no running
    resp = await client.get("/api/v1/tasks", cookies=cookies)
    task = [t for t in resp.json() if t["id"] == task_id][0]
    assert task["tracked_minutes"] >= 0
    assert task["running_entry_id"] is None
