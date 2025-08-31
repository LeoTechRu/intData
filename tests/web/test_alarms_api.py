import pytest
import pytest_asyncio
from datetime import timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
import core.db as db
from core.models import TgUser, Area, CalendarItem
from core.utils import utcnow

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


async def _prepare_item(item_owner: int | None = 1):
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            user = TgUser(telegram_id=1, first_name="tg")
            session.add(user)
            area = Area(owner_id=1, name="Area")
            session.add(area)
            await session.flush()
            now = utcnow()
            item = CalendarItem(
                owner_id=item_owner,
                area_id=area.id,
                title="Event",
                start_at=now + timedelta(hours=1),
                end_at=now + timedelta(hours=2),
            )
            session.add(item)
            await session.flush()
            return item.id, item.end_at


@pytest.mark.asyncio
async def test_create_alarm(client: AsyncClient):
    item_id, _ = await _prepare_item()
    cookies = {"telegram_id": "1"}
    now = utcnow()
    trigger = now + timedelta(hours=1, minutes=30)
    resp = await client.post(
        f"/api/v1/calendar/items/{item_id}/alarms",
        json={"trigger_at": trigger.isoformat()},
        cookies=cookies,
    )
    assert resp.status_code == 201
    assert resp.json()["id"] > 0


@pytest.mark.asyncio
async def test_alarm_time_bounds(client: AsyncClient):
    item_id, end_at = await _prepare_item()
    cookies = {"telegram_id": "1"}
    now = utcnow()
    past = now - timedelta(minutes=5)
    resp = await client.post(
        f"/api/v1/calendar/items/{item_id}/alarms",
        json={"trigger_at": past.isoformat()},
        cookies=cookies,
    )
    assert resp.status_code == 400
    over = end_at + timedelta(minutes=1)
    resp = await client.post(
        f"/api/v1/calendar/items/{item_id}/alarms",
        json={"trigger_at": over.isoformat()},
        cookies=cookies,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_alarm_item_without_owner(client: AsyncClient):
    item_id, _ = await _prepare_item(item_owner=None)
    cookies = {"telegram_id": "1"}
    trigger = utcnow() + timedelta(hours=1, minutes=30)
    resp = await client.post(
        f"/api/v1/calendar/items/{item_id}/alarms",
        json={"trigger_at": trigger.isoformat()},
        cookies=cookies,
    )
    assert resp.status_code == 201
