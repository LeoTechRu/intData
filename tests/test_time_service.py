import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from datetime import datetime

from core.services.time_service import TimeService
from core.models import Project, Area, Task


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


@pytest.mark.asyncio
async def test_start_bare_timer_creates_inbox_task(session):
    service = TimeService(session)
    entry = await service.start_timer(owner_id=1, description="Solo")
    task = await session.get(Task, entry.task_id)
    assert task is not None
    area = await session.get(Area, task.area_id)
    assert area and area.name == "Входящие"


@pytest.mark.asyncio
async def test_summary_grouping(session):
    svc = TimeService(session)
    # prepare project and area
    area = Area(owner_id=1, name="A1")
    session.add(area)
    await session.flush()
    project = Project(owner_id=1, area_id=area.id, name="P1")
    session.add(project)
    await session.flush()
    # entry for project on day1 (1h)
    e1 = await svc.start_timer(owner_id=1, description="Work", project_id=project.id, create_task_if_missing=False)
    e1.start_time = datetime(2024, 1, 1, 0, 0, 0)
    e1.end_time = datetime(2024, 1, 1, 1, 0, 0)
    # entry for same project day2 (0.5h)
    e2 = await svc.start_timer(owner_id=1, description="Work2", project_id=project.id, create_task_if_missing=False)
    e2.start_time = datetime(2024, 1, 2, 0, 0, 0)
    e2.end_time = datetime(2024, 1, 2, 0, 30, 0)
    # entry for another user (0.25h)
    e3 = await svc.start_timer(owner_id=2, description="Other", create_task_if_missing=False)
    e3.start_time = datetime(2024, 1, 1, 0, 0, 0)
    e3.end_time = datetime(2024, 1, 1, 0, 15, 0)
    await session.flush()

    by_day = await svc.summary(owner_id=1, group_by="day")
    assert {"day": "2024-01-01", "total_seconds": 3600} in by_day
    assert {"day": "2024-01-02", "total_seconds": 1800} in by_day
    by_project = await svc.summary(owner_id=1, group_by="project")
    assert by_project == [{"project_id": project.id, "total_seconds": 5400}]
    by_user = await svc.summary(owner_id=None, group_by="user")
    assert {"owner_id": 1, "total_seconds": 5400} in by_user
    assert {"owner_id": 2, "total_seconds": 900} in by_user
