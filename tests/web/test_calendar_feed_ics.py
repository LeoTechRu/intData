import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from datetime import timedelta

from backend.base import Base
import backend.db as db
from backend.models import Alarm, Area, CalendarItem, CalendarItemStatus
from backend.services.telegram_user_service import TelegramUserService
from backend.utils import utcnow
from tests.utils.seeds import ensure_tg_user

try:
    from backend.main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from orchestrator.main import app  # type: ignore


@pytest_asyncio.fixture
async def client(postgres_db):
    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_feed_contains_event_and_todo(client: AsyncClient):
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            user = await ensure_tg_user(session, 1, first_name="u")
            area = Area(owner_id=user.telegram_id, name="ICS", title="ICS Area")
            session.add(area)
            await session.flush()
            area_id = area.id
        async with TelegramUserService(session) as us:
            token = await us.generate_ics_token(user)
        await session.commit()
        async with session.begin():
            base = utcnow()
            event = CalendarItem(
                owner_id=1,
                title="Event",
                start_at=base,
                end_at=base + timedelta(hours=1),
                area_id=area_id,
            )
            task = CalendarItem(
                owner_id=1,
                title="Task",
                start_at=base + timedelta(days=1),
                status=CalendarItemStatus.planned,
                area_id=area_id,
            )
            session.add_all([event, task])
            await session.flush()
            session.add_all(
                [
                    Alarm(
                        item_id=event.id,
                        trigger_at=base - timedelta(minutes=15),
                    ),
                    Alarm(
                        item_id=task.id,
                        trigger_at=base + timedelta(days=1, minutes=-30),
                    ),
                ]
            )
    resp = await client.get(f"/api/v1/calendar/feed.ics?scope=all&token={token}")
    assert resp.status_code == 200
    text = resp.text
    assert "BEGIN:VEVENT" in text
    assert "BEGIN:VTODO" in text
    assert text.count("BEGIN:VALARM") == 2
    assert "TRIGGER;VALUE=DATE-TIME" in text
    assert "ACTION:DISPLAY" in text
    assert "DESCRIPTION:Event" in text
    assert "DESCRIPTION:Task" in text
