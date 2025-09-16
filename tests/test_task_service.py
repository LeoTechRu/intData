import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from core.services.task_service import TaskService
from core.models import (
    TaskStatus,
    TaskWatcherState,
    TaskWatcherLeftReason,
    TaskControlStatus,
    TaskRefuseReason,
    Area,
)


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
    area = Area(owner_id=1, name="A1")
    session.add(area)
    await session.flush()
    task = await service.create_task(owner_id=1, title="Test task", area_id=area.id)
    assert task.id is not None
    assert task.status == TaskStatus.todo
    tasks = await service.list_tasks(owner_id=1)
    assert len(tasks) == 1
    assert tasks[0].title == "Test task"


@pytest.mark.asyncio
async def test_task_custom_status(session):
    service = TaskService(session)
    area = Area(owner_id=1, name="A1")
    session.add(area)
    await session.flush()
    task = await service.create_task(
        owner_id=1, title="In progress", status=TaskStatus.in_progress, area_id=area.id
    )
    assert task.status == TaskStatus.in_progress



@pytest.mark.asyncio
async def test_mark_task_done(session):
    service = TaskService(session)
    area = Area(owner_id=1, name="A1")
    session.add(area)
    await session.flush()
    task = await service.create_task(owner_id=1, title="Task", area_id=area.id)
    done = await service.mark_done(task.id)
    assert done is not None
    assert done.status == TaskStatus.done


@pytest.mark.asyncio
async def test_update_and_delete_task(session):
    service = TaskService(session)
    area = Area(owner_id=1, name="A1")
    session.add(area)
    await session.flush()
    task = await service.create_task(owner_id=1, title="Old", area_id=area.id)
    updated = await service.update_task(task.id, title="New", cognitive_cost=2)
    assert updated.title == "New"
    assert updated.neural_priority == 0.5
    deleted = await service.delete_task(task.id)
    assert deleted is True
    tasks = await service.list_tasks(owner_id=1)
    assert tasks == []


@pytest.mark.asyncio
async def test_requires_area_or_project(session):
    service = TaskService(session)
    with pytest.raises(ValueError):
        await service.create_task(owner_id=1, title="No PARA")


@pytest.mark.asyncio
async def test_add_and_leave_watcher(session):
    service = TaskService(session)
    area = Area(owner_id=1, name="A1")
    session.add(area)
    await session.flush()
    task = await service.create_task(owner_id=1, title="Watch me", area_id=area.id)
    watcher = await service.add_watcher(task.id, watcher_id=99, added_by=1)
    assert watcher.state == TaskWatcherState.active
    active_watchers = await service.list_watchers(task.id)
    assert len(active_watchers) == 1
    assert active_watchers[0].watcher_id == 99
    left = await service.leave_watcher(
        task.id, 99, reason=TaskWatcherLeftReason.manual
    )
    assert left is True
    assert await service.list_watchers(task.id) == []


@pytest.mark.asyncio
async def test_stats_by_owner(session):
    service = TaskService(session)
    area = Area(owner_id=1, name="A1")
    session.add(area)
    await session.flush()
    done_task = await service.create_task(owner_id=1, title="Done", area_id=area.id)
    await service.mark_done(done_task.id)
    active_task = await service.create_task(owner_id=1, title="Active", area_id=area.id)
    dropped_task = await service.create_task(owner_id=1, title="Dropped", area_id=area.id)
    await service.update_task(
        dropped_task.id,
        control_status=TaskControlStatus.dropped,
        control_enabled=False,
        refused_reason=TaskRefuseReason.wont_do,
    )
    stats = await service.stats_by_owner(owner_id=1)
    assert stats["done"] == 1
    assert stats["active"] == 1
    assert stats["dropped"] == 1


@pytest.mark.asyncio
async def test_ensure_default_area(session):
    service = TaskService(session)
    area = await service.ensure_default_area(owner_id=7)
    assert area.slug == "inbox"
    again = await service.ensure_default_area(owner_id=7)
    assert again.id == area.id
