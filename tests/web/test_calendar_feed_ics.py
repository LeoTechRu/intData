import pytest
import pytest_asyncio
from httpx import AsyncClient
from datetime import timedelta

from base import Base
import core.db as db
from core.models import CalendarItem, CalendarItemStatus
from core.services.telegram_user_service import TelegramUserService
from core.utils import utcnow
from tests.utils.seeds import ensure_tg_user

try:
    from core.main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from main import app  # type: ignore


@pytest_asyncio.fixture
async def client(postgres_db):
    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_feed_contains_event_and_todo(client: AsyncClient):
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            user = await ensure_tg_user(session, 1, first_name="u")
        async with TelegramUserService(session) as us:
            token = await us.generate_ics_token(user)
        await session.commit()
        async with session.begin():
            session.add(
                CalendarItem(
                    owner_id=1,
                    title="Event",
                    start_at=utcnow(),
                    end_at=utcnow() + timedelta(hours=1),
                )
            )
            session.add(
                CalendarItem(
                    owner_id=1,
                    title="Task",
                    start_at=utcnow() + timedelta(days=1),
                    status=CalendarItemStatus.planned,
                )
            )
    resp = await client.get(f"/api/v1/calendar/feed.ics?scope=all&token={token}")
    assert resp.status_code == 200
    text = resp.text
    assert "BEGIN:VEVENT" in text
    assert "BEGIN:VTODO" in text
