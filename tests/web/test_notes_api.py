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
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
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
async def test_notes_crud(client: AsyncClient):
    telegram_id = await _create_tg_user(telegram_id=10)
    cookies = {"telegram_id": str(telegram_id)}

    # Create note without area_id -> inbox
    resp = await client.post("/api/v1/notes", json={"content": "A"}, cookies=cookies)
    assert resp.status_code == 201
    data = resp.json()
    assert data["area"]["name"] == "Входящие"

    inbox_area_id = data["area"]["id"]

    # Create area and project
    resp = await client.post("/api/v1/areas", json={"name": "Area"}, cookies=cookies)
    area_id = resp.json()["id"]
    resp = await client.post("/api/v1/projects", json={"name": "Proj", "area_id": area_id}, cookies=cookies)
    project_id = resp.json()["id"]

    resp = await client.post(
        "/api/v1/notes",
        json={"content": "B", "area_id": area_id, "project_id": project_id},
        cookies=cookies,
    )
    assert resp.status_code == 201

    # List notes
    resp = await client.get("/api/v1/notes", cookies=cookies)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2
    assert any(n.get("project") for n in items)

    first_id, second_id = [n["id"] for n in items]

    # Pin first note
    resp = await client.patch(
        f"/api/v1/notes/{first_id}", json={"pinned": True}, cookies=cookies
    )
    assert resp.json()["pinned"] is True
    resp = await client.get(
        "/api/v1/notes", params={"pinned": True}, cookies=cookies
    )
    assert [n["id"] for n in resp.json()] == [first_id]

    # Archive first note
    resp = await client.post(
        f"/api/v1/notes/{first_id}/archive", cookies=cookies
    )
    assert resp.status_code == 204
    resp = await client.get("/api/v1/notes", cookies=cookies)
    assert [n["id"] for n in resp.json()] == [second_id]
    resp = await client.get(
        "/api/v1/notes", params={"archived": True}, cookies=cookies
    )
    assert [n["id"] for n in resp.json()] == [first_id]
    await client.post(
        f"/api/v1/notes/{first_id}/unarchive", cookies=cookies
    )
    await client.patch(
        f"/api/v1/notes/{first_id}", json={"pinned": False}, cookies=cookies
    )

    # Reorder notes
    resp = await client.post(
        "/api/v1/notes/reorder",
        json={"area_id": inbox_area_id, "ids": [second_id, first_id]},
        cookies=cookies,
    )
    assert resp.status_code == 204
    resp = await client.get("/api/v1/notes", cookies=cookies)
    assert [n["id"] for n in resp.json()] == [second_id, first_id]

    # Delete second note
    resp = await client.delete(f"/api/v1/notes/{second_id}", cookies=cookies)
    assert resp.status_code == 204

    resp = await client.get("/api/v1/notes", cookies=cookies)
    assert len(resp.json()) == 1
    assert resp.json()[0]["area"]["id"] == inbox_area_id
