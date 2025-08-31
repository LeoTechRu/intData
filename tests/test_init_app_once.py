from __future__ import annotations

import threading
from pathlib import Path
import threading
import asyncio

import pytest
import importlib

db_engine = importlib.import_module("core.db.engine")
init_app = importlib.import_module("core.db.init_app")
from core.env import env


@pytest.fixture()
def dummy_engine(monkeypatch):
    class DummySyncConn:
        def execute(self, *a, **k):
            pass

    class DummyConn:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        async def run_sync(self, fn, *a, **kw):
            return fn(DummySyncConn(), *a, **kw)

    class DummyEngine:
        def begin(self):
            return DummyConn()

    engine = DummyEngine()
    monkeypatch.setattr(db_engine, "engine", engine)
    monkeypatch.setattr(init_app, "engine", engine)
    return engine


@pytest.mark.asyncio
async def test_init_app_once_idempotent(dummy_engine, monkeypatch):
    env.DB_BOOTSTRAP = True
    env.DB_REPAIR = False
    env.DEV_INIT_MODELS = False
    calls = {"count": 0}

    def fake_bootstrap(conn):
        calls["count"] += 1

    monkeypatch.setattr(init_app, "run_bootstrap_sql", fake_bootstrap)
    monkeypatch.setattr(init_app, "run_repair", lambda conn: None)
    monkeypatch.setattr(init_app, "_init_done", False)
    monkeypatch.setattr(init_app, "_advisory_lock", lambda c, k: True)
    monkeypatch.setattr(init_app, "_advisory_unlock", lambda c, k: None)

    await init_app.init_app_once(env)
    await init_app.init_app_once(env)
    assert calls["count"] == 1


@pytest.mark.asyncio
async def test_init_app_once_parallel(dummy_engine, monkeypatch):
    env.DB_BOOTSTRAP = True
    env.DB_REPAIR = False
    env.DEV_INIT_MODELS = False
    calls = {"count": 0}

    def fake_bootstrap(conn):
        calls["count"] += 1

    monkeypatch.setattr(init_app, "run_bootstrap_sql", fake_bootstrap)
    monkeypatch.setattr(init_app, "run_repair", lambda conn: None)
    monkeypatch.setattr(init_app, "_init_done", False)

    lock = threading.Lock()
    state = {"locked": False}

    def fake_lock(conn, key):
        with lock:
            if state["locked"]:
                return False
            state["locked"] = True
            return True

    def fake_unlock(conn, key):
        with lock:
            state["locked"] = False

    monkeypatch.setattr(init_app, "_advisory_lock", fake_lock)
    monkeypatch.setattr(init_app, "_advisory_unlock", fake_unlock)

    async def worker():
        await init_app.init_app_once(env)

    await asyncio.gather(worker(), worker())
    assert calls["count"] == 1


def test_entrypoints_use_init_app_once():
    bot_src = Path("bot/main.py").read_text()
    web_src = Path("web/__init__.py").read_text()
    assert "init_app_once" in bot_src
    assert "run_bootstrap" not in bot_src
    assert "init_models" not in bot_src
    assert "init_app_once" in web_src
    assert "run_bootstrap" not in web_src
    assert "init_models" not in web_src
