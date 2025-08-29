import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from core.services.reminder_service import ReminderService
from core.utils import utcnow
from core.models import Task


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
async def test_create_and_list_reminders(session):
    service = ReminderService(session)
    remind_at = utcnow()
    reminder = await service.create_reminder(
        owner_id=1, message="Ping", remind_at=remind_at
    )
    assert reminder.id is not None
    reminders = await service.list_reminders(owner_id=1)
    assert len(reminders) == 1
    assert reminders[0].message == "Ping"


@pytest.mark.asyncio
async def test_create_reminder_with_task(session):
    task = Task(owner_id=1, title="T")
    session.add(task)
    await session.flush()
    service = ReminderService(session)
    remind_at = utcnow()
    reminder = await service.create_reminder(
        owner_id=1, message="For task", remind_at=remind_at, task_id=task.id
    )
    assert reminder.task_id == task.id
    reminders = await service.list_reminders(task_id=task.id)
    assert len(reminders) == 1
    assert reminders[0].task_id == task.id


@pytest.mark.asyncio
async def test_mark_done(session):
    service = ReminderService(session)
    remind_at = utcnow()
    reminder = await service.create_reminder(
        owner_id=1, message="Task", remind_at=remind_at
    )
    assert reminder.is_done is False
    updated = await service.mark_done(reminder.id)
    assert updated.is_done is True


@pytest.mark.asyncio
async def test_update_and_delete_reminder(session):
    service = ReminderService(session)
    remind_at = utcnow()
    reminder = await service.create_reminder(
        owner_id=1, message="Old", remind_at=remind_at
    )
    updated = await service.update_reminder(reminder.id, message="New")
    assert updated.message == "New"
    deleted = await service.delete_reminder(reminder.id)
    assert deleted is True
    reminders = await service.list_reminders(owner_id=1)
    assert reminders == []
