import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

import core.db as db
from base import Base
from core.services.reminder_service import ReminderService
from core.utils import utcnow
from core.services.notification_service import fetch_due_reminders, mark_done
from datetime import timedelta


@pytest_asyncio.fixture
async def session_maker():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    db.async_session = async_session
    try:
        yield async_session
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_fetch_and_mark_due_reminders(session_maker):
    # Create two reminders: one due, one in the future
    async with ReminderService() as svc:
        r1 = await svc.create_reminder(owner_id=1, message="Ping", remind_at=utcnow())
        _ = await svc.create_reminder(
            owner_id=1,
            message="Later",
            remind_at=utcnow() + timedelta(hours=1),
        )
    # fetch_due_reminders should at least return the first one
    due = await fetch_due_reminders()
    assert any(r.id == r1.id for r in due)

    # Mark the returned first id as done
    await mark_done([r1.id])

    # Verify it no longer appears in due
    due_after = await fetch_due_reminders()
    assert all(r.id != r1.id for r in due_after)
