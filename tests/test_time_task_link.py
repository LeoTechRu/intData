import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from core.models import Task, TaskStatus, Area, TgUser
from core.services.time_service import TimeService
from core.services.task_service import TaskService
from core.utils import utcnow


@pytest_asyncio.fixture
async def session(postgres_engine):
    engine = postgres_engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session = sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )
    async with async_session() as sess:
        yield sess


async def ensure_tg_user(session: AsyncSession, telegram_id: int) -> None:
    if await session.get(TgUser, telegram_id) is None:
        session.add(TgUser(telegram_id=telegram_id, first_name=f"tg{telegram_id}"))
        await session.flush()


@pytest.mark.asyncio
async def test_time_entry_links_to_task_and_updates_status(session):
    # start timer without task_id -> auto create task
    tsvc = TaskService(session)
    time_svc = TimeService(session)
    await ensure_tg_user(session, 1)
    entry = await time_svc.start_timer(owner_id=1, description="Demo work")
    # task auto-created
    assert entry.task_id is not None
    task = await session.get(Task, entry.task_id)
    assert task is not None
    area = await session.get(Area, task.area_id)
    assert area and area.name == "Входящие"

    # task should move to in_progress
    updated = await session.get(Task, task.id)
    assert updated.status == TaskStatus.in_progress

    # stop and verify aggregation
    stopped = await time_svc.stop_timer(entry.id)
    assert stopped.end_time is not None

    total = await tsvc.total_tracked_minutes(task.id)
    assert total >= 0


@pytest.mark.asyncio
async def test_resume_accumulates_time(session):
    time_svc = TimeService(session)
    # start new task via timer
    await ensure_tg_user(session, 1)
    e1 = await time_svc.start_timer(owner_id=1, description="Task A")
    task_id = e1.task_id
    assert task_id
    await time_svc.stop_timer(e1.id)
    # resume on same task
    e2 = await time_svc.resume_task(owner_id=1, task_id=task_id)
    assert e2.task_id == task_id
    await time_svc.stop_timer(e2.id)
    # verify aggregation returns non-negative
    tsvc = TaskService(session)
    total = await tsvc.total_tracked_minutes(task_id)
    assert total >= 0


@pytest.mark.asyncio
async def test_cannot_link_task_of_another_owner(session):
    # Task belongs to owner 1
    tsvc = TaskService(session)
    await ensure_tg_user(session, 1)
    await ensure_tg_user(session, 2)
    area = Area(owner_id=1, name="A1")
    session.add(area)
    await session.flush()
    task = await tsvc.create_task(owner_id=1, title="Forbidden", area_id=area.id)

    time_svc = TimeService(session)
    with pytest.raises(PermissionError):
        await time_svc.start_timer(owner_id=2, task_id=task.id)
