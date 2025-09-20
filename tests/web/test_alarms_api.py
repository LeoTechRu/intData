import pytest
import pytest_asyncio
from datetime import timedelta
from httpx import AsyncClient

from base import Base
import core.db as db
from core.models import Area, CalendarItem
from core.services.alarm_service import AlarmService
from core.utils import utcnow_aware
from tests.utils.seeds import ensure_tg_user

try:
    from main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from main import app  # type: ignore


@pytest_asyncio.fixture
async def client(postgres_db, monkeypatch):
    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    monkeypatch.setattr("web.routes.alarms.utcnow", utcnow_aware)
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


async def _prepare_item(item_owner: int | None = 1):
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            user = await ensure_tg_user(session, 1, first_name="tg")
            owner_id = user.telegram_id
            area = Area(owner_id=owner_id, name="Area")
            session.add(area)
            await session.flush()
            now = utcnow_aware()
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
    now = utcnow_aware()
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
    now = utcnow_aware()
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
    trigger = utcnow_aware() + timedelta(hours=1, minutes=30)
    resp = await client.post(
        f"/api/v1/calendar/items/{item_id}/alarms",
        json={"trigger_at": trigger.isoformat()},
        cookies=cookies,
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_alarms_returns_sorted(client: AsyncClient):
    item_id, _ = await _prepare_item()
    cookies = {"telegram_id": "1"}
    now = utcnow_aware()
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            service = AlarmService(session)
            await service.create_alarm(
                item_id=item_id, trigger_at=now + timedelta(minutes=90)
            )
            await service.create_alarm(
                item_id=item_id, trigger_at=now + timedelta(minutes=30)
            )
    resp = await client.get(
        f"/api/v1/calendar/items/{item_id}/alarms",
        cookies=cookies,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["trigger_at"] < data[1]["trigger_at"]


@pytest.mark.asyncio
async def test_list_alarms_requires_auth(client: AsyncClient):
    item_id, _ = await _prepare_item()
    resp = await client.get(f"/api/v1/calendar/items/{item_id}/alarms")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_alarms_other_owner_empty(client: AsyncClient):
    item_id, _ = await _prepare_item()
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            await ensure_tg_user(session, 2, first_name="other")
    cookies = {"telegram_id": "2"}
    resp = await client.get(
        f"/api/v1/calendar/items/{item_id}/alarms",
        cookies=cookies,
    )
    assert resp.status_code == 200
    assert resp.json() == []
