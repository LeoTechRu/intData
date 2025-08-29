import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import inspect

import core.db as db


@pytest.mark.asyncio
async def test_init_models_creates_tables():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:?cache=shared")
    db.engine = engine
    db.async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    await db.init_models()
    async with engine.begin() as conn:
        tables = await conn.run_sync(lambda s: inspect(s).get_table_names())
    assert "users_tg" in tables
    assert "users_web" in tables
