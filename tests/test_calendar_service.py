import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from core.services.calendar_service import CalendarService
from datetime import datetime


@pytest_asyncio.fixture
async def session(postgres_db):
    engine, session_factory = postgres_db
    async with session_factory() as sess:
        yield sess


@pytest.mark.asyncio
async def test_calendar_event_create_and_list(session):
    service = CalendarService(session)
    event = await service.create_event(owner_id=1, title="Meeting", start_at=datetime(2024, 1, 1))
    assert event.id is not None
    events = await service.list_events(owner_id=1)
    assert len(events) == 1
    assert events[0].title == "Meeting"
