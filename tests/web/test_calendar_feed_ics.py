import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from datetime import timedelta

from base import Base
import core.db as db
from core.models import TgUser, CalendarItem, CalendarItemStatus
from core.services.telegram_user_service import TelegramUserService
from core.utils import utcnow

try:
    from core.main import app  # type: ignore
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


@pytest.mark.asyncio
async def test_feed_contains_event_and_todo(client: AsyncClient):
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            user = TgUser(telegram_id=1, first_name="u")
            session.add(user)
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
