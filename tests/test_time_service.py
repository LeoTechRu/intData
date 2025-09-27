import pytest
import pytest_asyncio

from backend.base import Base
from datetime import datetime

from backend.services.time_service import TimeService
from backend.models import Project, Area, Task, TgUser
from sqlalchemy import func, select


@pytest_asyncio.fixture
async def session(postgres_db):
    engine, session_factory = postgres_db
    async with session_factory() as sess:
        yield sess


@pytest.mark.asyncio
async def test_time_entry_start_and_stop(session):
    service = TimeService(session)
    entry = await service.start_timer(owner_id=1, description="Work")
    assert entry.id is not None
    assert entry.end_time is None
    assert entry.is_running
    assert entry.active_seconds == 0
    stopped = await service.stop_timer(entry.id)
    assert stopped.end_time is not None
    assert stopped.last_started_at is None
    assert stopped.active_seconds >= 0
    entries = await service.list_entries(owner_id=1)
    assert len(entries) == 1
    assert entries[0].end_time is not None


@pytest.mark.asyncio
async def test_pause_and_resume(session):
    service = TimeService(session)
    entry = await service.start_timer(owner_id=1, description="Deep work")
    assert entry.is_running
    paused = await service.pause_timer(entry.id, owner_id=1)
    assert paused.is_paused
    assert paused.last_started_at is None
    assert paused.paused_at is not None
    resumed = await service.resume_entry(entry.id, owner_id=1)
    assert resumed.is_running
    assert resumed.paused_at is None
    finished = await service.stop_timer(entry.id)
    assert finished.end_time is not None
    assert finished.active_seconds >= 0


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
    e1.active_seconds = 3600
    e1.last_started_at = None
    # entry for same project day2 (0.5h)
    e2 = await svc.start_timer(owner_id=1, description="Work2", project_id=project.id, create_task_if_missing=False)
    e2.start_time = datetime(2024, 1, 2, 0, 0, 0)
    e2.end_time = datetime(2024, 1, 2, 0, 30, 0)
    e2.active_seconds = 1800
    e2.last_started_at = None
    # entry for another user (0.25h)
    e3 = await svc.start_timer(owner_id=2, description="Other", create_task_if_missing=False)
    e3.start_time = datetime(2024, 1, 1, 0, 0, 0)
    e3.end_time = datetime(2024, 1, 1, 0, 15, 0)
    e3.active_seconds = 900
    e3.last_started_at = None
    await session.flush()

    by_day = await svc.summary(owner_id=1, group_by="day")
    assert {"day": "2024-01-01", "total_seconds": 3600} in by_day
    assert {"day": "2024-01-02", "total_seconds": 1800} in by_day
    by_project = await svc.summary(owner_id=1, group_by="project")
    assert by_project == [{"project_id": project.id, "total_seconds": 5400}]
    by_user = await svc.summary(owner_id=None, group_by="user")
    assert {"owner_id": 1, "total_seconds": 5400} in by_user
    assert {"owner_id": 2, "total_seconds": 900} in by_user
