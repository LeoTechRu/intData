import pytest
import pytest_asyncio
from httpx import AsyncClient

from base import Base
import backend.db as db
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
async def test_notes_page_renders_cards(client: AsyncClient):
    telegram_id = await _create_tg_user(telegram_id=20)
    cookies = {"telegram_id": str(telegram_id)}

    # create note
    await client.post("/api/v1/notes", json={"content": "Test"}, cookies=cookies)

    resp = await client.get("/notes", cookies=cookies)
    assert resp.status_code == 200
    html = resp.text
    assert 'Заметки' in html
    assert 'app-shell-title' in html
    assert 'Intelligent Data Pro' in html
    assert 'data-app-shell' in html
