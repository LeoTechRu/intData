import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from base import Base
import core.db as db
from core.models import WebUser
from core.services.habits import metadata

try:
    from main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from main import app  # type: ignore


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:?cache=shared", connect_args={"uri": True}
    )
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(metadata.create_all)
    db.engine = engine
    db.async_session = async_session
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    await engine.dispose()


@pytest.mark.asyncio
async def test_page_without_tg(client: AsyncClient):
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            session.add(WebUser(id=10, username="u"))
    resp = await client.get("/habits", cookies={"web_user_id": "10"})
    assert resp.status_code == 200
    assert "Привяжите Telegram" in resp.text
