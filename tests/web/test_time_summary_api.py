import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from datetime import datetime

from base import Base
import core.db as db
from core.models import TgUser, TimeEntry

try:
    from main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from main import app  # type: ignore


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:?cache=shared")
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    db.engine = engine
    db.async_session = async_session
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    await engine.dispose()


async def _create_tg_user(telegram_id: int) -> int:
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            tg = TgUser(telegram_id=telegram_id, first_name="tg")
            session.add(tg)
    return telegram_id


async def _add_entry(owner_id: int, start: datetime, end: datetime) -> None:
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            session.add(TimeEntry(owner_id=owner_id, start_time=start, end_time=end))


@pytest.mark.asyncio
async def test_time_summary_api(client: AsyncClient):
    user_id = await _create_tg_user(telegram_id=55)
    await _add_entry(user_id, datetime(2024, 1, 1, 0, 0, 0), datetime(2024, 1, 1, 1, 0, 0))
    await _add_entry(user_id, datetime(2024, 1, 2, 0, 0, 0), datetime(2024, 1, 2, 0, 30, 0))
    cookies = {"telegram_id": str(user_id)}
    resp = await client.get("/api/v1/time/summary?group_by=day", cookies=cookies)
    assert resp.status_code == 200
    data = resp.json()
    assert any(d["day"] == "2024-01-01" and d["total_seconds"] == 3600 for d in data)
    assert any(d["day"] == "2024-01-02" and d["total_seconds"] == 1800 for d in data)
