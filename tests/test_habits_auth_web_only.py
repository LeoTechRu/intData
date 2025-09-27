import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from backend.base import Base
import backend.db as db
from backend.models import WebUser
from backend.services.habits import metadata

try:
    from orchestrator.main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from orchestrator.main import app  # type: ignore


@pytest_asyncio.fixture
async def client(postgres_db):
    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(metadata.create_all)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_habits_auth_web_only(client: AsyncClient):
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            session.add(WebUser(id=10, username="u"))
    resp = await client.get("/habits", cookies={"web_user_id": "10"})
    assert resp.status_code == 200

    api_resp = await client.get("/api/v1/habits", cookies={"web_user_id": "10"})
    assert api_resp.status_code == 200
    assert api_resp.json() == []

    up_resp = await client.post("/api/v1/habits/1/up", cookies={"web_user_id": "10"})
    assert up_resp.status_code == 403
    up_detail = up_resp.json().get("detail", {})
    assert up_detail.get("error") == "tg_link_required"
