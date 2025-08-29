import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
import core.db as db
from core.models import TgUser

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
async def test_task_time_summary_and_actions(client: AsyncClient):
    telegram_id = await _create_tg_user(telegram_id=33)
    cookies = {"telegram_id": str(telegram_id)}

    # Create task
    resp = await client.post("/api/tasks", json={"title": "Tracked Task"}, cookies=cookies)
    assert resp.status_code == 201
    task_id = resp.json()["id"]

    # Start timer for task
    resp = await client.post(f"/api/tasks/{task_id}/start_timer", cookies=cookies)
    assert resp.status_code == 200

    # List tasks -> running_entry_id should be present
    resp = await client.get("/api/tasks", cookies=cookies)
    assert resp.status_code == 200
    task = [t for t in resp.json() if t["id"] == task_id][0]
    assert task["running_entry_id"] is not None

    # Stop via time stop endpoint
    entry_id = task["running_entry_id"]
    resp = await client.post(f"/api/time/{entry_id}/stop", cookies=cookies)
    assert resp.status_code == 200

    # List tasks -> tracked_minutes >= 0 and no running
    resp = await client.get("/api/tasks", cookies=cookies)
    task = [t for t in resp.json() if t["id"] == task_id][0]
    assert task["tracked_minutes"] >= 0
    assert task["running_entry_id"] is None

