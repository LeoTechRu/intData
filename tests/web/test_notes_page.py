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
async def test_notes_page_renders_cards(client: AsyncClient):
    telegram_id = await _create_tg_user(telegram_id=20)
    cookies = {"telegram_id": str(telegram_id)}

    # create note
    await client.post("/api/v1/notes", json={"content": "Test"}, cookies=cookies)

    resp = await client.get("/notes", cookies=cookies)
    assert resp.status_code == 200
    html = resp.text
    assert 'c-card' in html
    assert 'js-del' in html
    assert 'js-edit' in html
    assert 'chip--area' in html
