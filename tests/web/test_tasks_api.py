import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from backend.base import Base
import backend.db as db
from backend.services.area_service import AreaService
from tests.utils.seeds import ensure_tg_user

try:
    from orchestrator.main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from orchestrator.main import app  # type: ignore


@pytest_asyncio.fixture
async def client(postgres_db):
    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def _create_tg_user(telegram_id: int = 1) -> int:
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            await ensure_tg_user(session, telegram_id, first_name="tg")
    return telegram_id


@pytest.mark.asyncio
async def test_create_and_complete_task(client: AsyncClient):
    telegram_id = await _create_tg_user(telegram_id=10)
    cookies = {"telegram_id": str(telegram_id)}

    async with AreaService() as asvc:
        area = await asvc.create_area(owner_id=telegram_id, name="Inbox")

    resp = await client.post(
        "/api/v1/tasks",
        json={"title": "Test", "area_id": area.id},
        cookies=cookies,
    )
    assert resp.status_code == 201
    task_id = resp.json()["id"]

    resp = await client.post(f"/api/v1/tasks/{task_id}/done", cookies=cookies)
    assert resp.status_code == 200
    assert resp.json()["status"] == "done"

    resp = await client.get("/api/v1/tasks", cookies=cookies)
    assert resp.status_code == 200
    tasks = resp.json()
    assert len(tasks) == 1
    assert tasks[0]["status"] == "done"
    assert tasks[0]["control_enabled"] is False
    assert tasks[0]["control_status"] == "dropped"
    assert tasks[0]["is_watched"] is False

    stats_resp = await client.get("/api/v1/tasks/stats", cookies=cookies)
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["done"] == 1
    assert stats["active"] == 0
    assert stats["dropped"] == 0
