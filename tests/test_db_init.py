import pytest
from sqlalchemy.orm import sessionmaker
from sqlalchemy import inspect
import importlib

import core.db as db
db_engine = importlib.import_module("core.db.engine")


@pytest.mark.asyncio
async def test_init_models_creates_tables(postgres_db):
    engine, session_factory = postgres_db
    original_engine = getattr(db_engine, "engine", None)
    had_engine = hasattr(db_engine, "engine")
    db.engine = engine
    db_engine.engine = engine
    db.async_session = session_factory
    await db.init_models()
    async with engine.begin() as conn:
        tables = await conn.run_sync(lambda s: inspect(s).get_table_names())
    assert "users_tg" in tables
    assert "users_web" in tables
    if had_engine:
        db_engine.engine = original_engine
    else:
        delattr(db_engine, "engine")
