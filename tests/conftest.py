import os
import sys
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault('TG_BOT_TOKEN', 'TEST_TOKEN')
os.environ.setdefault('TG_BOT_USERNAME', 'testbot')

from base import Base  # noqa: E402
import backend.db as db  # noqa: E402
from backend.models import TgUser  # noqa: E402
from backend.services.habits import metadata as habits_metadata  # noqa: E402
from backend.services.access_control import AccessControlService  # noqa: E402
from tests.utils import db as db_utils
from sqlalchemy import event, text


@pytest_asyncio.fixture(scope='function')
async def session():
    async with db_utils.async_engine() as engine:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        Session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
        async with Session() as sess:
            yield sess
            await sess.rollback()


@pytest_asyncio.fixture(scope='function')
async def postgres_engine():
    async with db_utils.async_engine() as engine:
        yield engine


@pytest.fixture(scope='function')
def postgres_sync_engine():
    with db_utils.sync_engine() as engine:
        yield engine


@pytest_asyncio.fixture(scope='function')
async def postgres_db(postgres_engine):
    import importlib

    importlib.import_module("core.models")
    session_factory = sessionmaker(postgres_engine, expire_on_commit=False, class_=AsyncSession)

    async with postgres_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(habits_metadata.create_all)
        await conn.execute(
            text(
                "INSERT INTO users_tg (telegram_id, first_name, created_at, updated_at) "
                "SELECT gs, CONCAT('auto', gs), NOW(), NOW() "
                "FROM generate_series(1, 256) AS gs"
            )
        )

    AccessControlService.invalidate_cache()
    async with session_factory() as session:
        async with session.begin():
            access = AccessControlService(session)
            await access.seed_presets()

    had_engine = hasattr(db, 'engine')
    original_engine = getattr(db, 'engine', None)
    had_async_session = hasattr(db, 'async_session')
    original_async_session = getattr(db, 'async_session', None)

    db.engine = postgres_engine
    db.async_session = session_factory

    try:
        yield postgres_engine, session_factory
    finally:
        if had_engine:
            db.engine = original_engine
        else:
            delattr(db, 'engine')

        if had_async_session:
            db.async_session = original_async_session
        else:
            delattr(db, 'async_session')
