import pytest
from datetime import timedelta

import backend.db as db
from base import Base
from backend.models import (
    Area,
    CalendarItem,
    Daily,
    Habit,
    Note,
    Project,
    Reward,
    Task,
    TimeEntry,
)
from backend.utils import utcnow
from sqlalchemy.exc import IntegrityError
from tests.utils.seeds import ensure_tg_user

TABLE_CASES = [
    (CalendarItem, {"title": "Item", "start_at": utcnow()}, True),
    (Task, {"title": "Task"}, True),
    (TimeEntry, {}, True),
    (Note, {"title": "Note", "content": "Text"}, False),
    (
        Habit,
        {
            "title": "Habit",
            "type": "positive",
            "difficulty": "easy",
            "frequency": "daily",
        },
        False,
    ),
    (
        Daily,
        {
            "title": "Daily",
            "rrule": "FREQ=DAILY",
            "difficulty": "easy",
        },
        False,
    ),
    (Reward, {"title": "Reward"}, False),
]


@pytest.mark.asyncio
async def test_para_single_container_constraint(postgres_db):
    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            user = await ensure_tg_user(session, 501, first_name="para")
            owner = user.telegram_id
            area = Area(owner_id=owner, name="Area", title="Area")
            session.add(area)
            await session.flush()
            project = Project(owner_id=owner, area_id=area.id, name="Project")
            session.add(project)
            await session.flush()
            area_id = area.id
            project_id = project.id

        for model, base_kwargs, allow_both_null in TABLE_CASES:
            # disallow both containers being null (where applicable)
            if allow_both_null:
                async with session.begin():
                    obj = model(owner_id=owner, area_id=None, project_id=None, **base_kwargs)
                    session.add(obj)
                    with pytest.raises(IntegrityError):
                        await session.flush()

            # disallow having both containers simultaneously
            async with session.begin():
                obj = model(
                    owner_id=owner,
                    area_id=area_id,
                    project_id=project_id,
                    **base_kwargs,
                )
                session.add(obj)
                with pytest.raises(IntegrityError):
                    await session.flush()


@pytest.mark.asyncio
async def test_calendar_item_requires_either_area_or_project(postgres_db):
    """Sanity check: valid combinations still work."""

    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            user = await ensure_tg_user(session, 777, first_name="ok")
            owner = user.telegram_id
            area = Area(owner_id=owner, name="SoloArea", title="Solo")
            session.add(area)
            await session.flush()
            project = Project(owner_id=owner, area_id=area.id, name="SoloProject")
            session.add(project)
            await session.flush()

            item_area = CalendarItem(
                owner_id=owner,
                title="Area Item",
                start_at=utcnow() + timedelta(hours=1),
                area_id=area.id,
            )
            session.add(item_area)

            item_project = CalendarItem(
                owner_id=owner,
                title="Project Item",
                start_at=utcnow() + timedelta(hours=2),
                project_id=project.id,
            )
            session.add(item_project)
        # flush succeeded implies both variants accepted
        assert item_area.area_id == area.id
        assert item_project.project_id == project.id
