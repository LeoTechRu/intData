from __future__ import annotations

import asyncio
import importlib
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import create_async_engine

from core.env import env
from core.db import bootstrap


db_engine = importlib.import_module("core.db.engine")
init_app = importlib.import_module("core.db.init_app")


@pytest.fixture()
def dummy_engine(monkeypatch):
    class DummySyncConn:
        def exec_driver_sql(self, *a, **k):
            pass

        def commit(self):
            pass

        def rollback(self):
            pass

    class DummyConn:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        async def run_sync(self, fn, *a, **kw):
            return fn(DummySyncConn(), *a, **kw)

    class DummyEngine:
        def connect(self):
            return DummyConn()

    engine = DummyEngine()
    monkeypatch.setattr(db_engine, "engine", engine)
    monkeypatch.setattr(init_app, "engine", engine)
    monkeypatch.setattr(db_engine, "ENGINE_MODE", "async")
    monkeypatch.setattr(init_app, "ENGINE_MODE", "async")
    return engine


@pytest.mark.asyncio
async def test_init_app_once_idempotent(dummy_engine, monkeypatch):
    env.DB_BOOTSTRAP = True
    env.DB_REPAIR = False
    env.DEV_INIT_MODELS = False
    calls = {"count": 0}

    def fake_bootstrap(conn):
        calls["count"] += 1
        return {"files": 0, "executed": 0, "failed": 0}

    monkeypatch.setattr(init_app, "run_bootstrap_sql", fake_bootstrap)
    monkeypatch.setattr(init_app, "run_repair", lambda conn: None)
    monkeypatch.setattr(init_app, "_inited", False)
    monkeypatch.setattr(init_app, "_advisory_lock", lambda c, k: True)
    monkeypatch.setattr(init_app, "_advisory_unlock", lambda c, k: None)

    await init_app.init_app_once(env)
    await init_app.init_app_once(env)
    assert calls["count"] == 1


@pytest.mark.asyncio
async def test_init_app_once_executes_after_failure(tmp_path, monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    monkeypatch.setattr(db_engine, "engine", engine)
    monkeypatch.setattr(init_app, "engine", engine)
    monkeypatch.setattr(db_engine, "ENGINE_MODE", "async")
    monkeypatch.setattr(init_app, "ENGINE_MODE", "async")

    ddl_dir = tmp_path
    ddl_file = ddl_dir / "001_test.sql"
    ddl_file.write_text(
        "CREATE TABLE t1(id INT);\n" "ALTER TABLE not_exist ADD COLUMN foo INT;\n" "CREATE TABLE t2(id INT);"
    )
    monkeypatch.setattr(bootstrap, "DDL_DIR", ddl_dir)

    env.DB_BOOTSTRAP = True
    env.DB_REPAIR = False
    env.DEV_INIT_MODELS = False
    monkeypatch.setattr(init_app, "_inited", False)
    monkeypatch.setattr(init_app, "run_repair", lambda conn: None)

    await init_app.init_app_once(env)

    async with engine.connect() as conn:
        res = await conn.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='t2'"
        )
        assert res.first() is not None
        res = await conn.exec_driver_sql("SELECT 1")
        assert res.scalar() == 1

    await engine.dispose()


def test_entrypoints_use_init_app_once():
    bot_src = Path("bot/main.py").read_text()
    web_src = Path("web/__init__.py").read_text()
    assert "init_app_once" in bot_src
    assert "run_bootstrap" not in bot_src
    assert "init_models" not in bot_src
    assert "init_app_once" in web_src
    assert "run_bootstrap" not in web_src
    assert "init_models" not in web_src
