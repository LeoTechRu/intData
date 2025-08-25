import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from core.services.task_service import TaskService
from core.models import TaskStatus
from core.services.reminder_service import ReminderService
from core.utils import utcnow


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
async def test_task_creation_and_listing(session):
    service = TaskService(session)
    task = await service.create_task(owner_id=1, title="Test task")
    assert task.id is not None
    assert task.status == TaskStatus.todo
    tasks = await service.list_tasks(owner_id=1)
    assert len(tasks) == 1
    assert tasks[0].title == "Test task"


@pytest.mark.asyncio
async def test_task_custom_status(session):
    service = TaskService(session)
    task = await service.create_task(
        owner_id=1, title="In progress", status=TaskStatus.in_progress
    )
    assert task.status == TaskStatus.in_progress


@pytest.mark.asyncio
async def test_add_reminder_to_task(session):
    service = TaskService(session)
    task = await service.create_task(owner_id=1, title="Task")
    remind_at = utcnow()
    reminder = await service.add_reminder(
        task.id, "Do it", remind_at
    )
    assert reminder is not None
    assert reminder.task_id == task.id
    reminders = await ReminderService(session).list_reminders(task_id=task.id)
    assert len(reminders) == 1
