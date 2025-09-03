import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from core.services.task_service import TaskService
from core.models import TaskStatus, Area


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
