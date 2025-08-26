import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from core.services.time_service import TimeService


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session = sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )
    async with async_session() as sess:
        yield sess


@pytest.mark.asyncio
async def test_time_entry_start_and_stop(session):
    service = TimeService(session)
    entry = await service.start_timer(owner_id=1, description="Work")
    assert entry.id is not None
    assert entry.end_time is None
    stopped = await service.stop_timer(entry.id)
    assert stopped.end_time is not None
    entries = await service.list_entries(owner_id=1)
    assert len(entries) == 1
    assert entries[0].end_time is not None
