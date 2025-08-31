from __future__ import annotations

import threading
from pathlib import Path
import threading

import pytest
import importlib

db_engine = importlib.import_module("core.db.engine")
init_app = importlib.import_module("core.db.init_app")
from core.env import env


@pytest.fixture()
def dummy_engine(monkeypatch):
    class DummyConn:
        def execute(self, *a, **k):
            pass

    class DummySync:
        def begin(self):
            class Ctx:
                def __enter__(self_inner):
                    return DummyConn()

                def __exit__(self_inner, exc_type, exc, tb):
                    pass

            return Ctx()

    class DummyEngine:
        sync_engine = DummySync()

    engine = DummyEngine()
    monkeypatch.setattr(db_engine, "engine", engine)
    monkeypatch.setattr(init_app, "engine", engine)
    return engine


def test_init_app_once_idempotent(dummy_engine, monkeypatch):
    env.DB_BOOTSTRAP = True
    env.DB_REPAIR = False
    env.DEV_INIT_MODELS = False
    calls = {"count": 0}

    def fake_bootstrap(conn):
        calls["count"] += 1

    monkeypatch.setattr(init_app, "run_bootstrap_sql", fake_bootstrap)
    monkeypatch.setattr(init_app, "run_repair", lambda conn: None)
    monkeypatch.setattr(init_app, "_init_done", False)

    init_app.init_app_once(env)
    init_app.init_app_once(env)
    assert calls["count"] == 1


def test_init_app_once_parallel(dummy_engine, monkeypatch):
    env.DB_BOOTSTRAP = True
    env.DB_REPAIR = False
    env.DEV_INIT_MODELS = False
    calls = {"count": 0}

    def fake_bootstrap(conn):
        calls["count"] += 1

    monkeypatch.setattr(init_app, "run_bootstrap_sql", fake_bootstrap)
    monkeypatch.setattr(init_app, "run_repair", lambda conn: None)
    monkeypatch.setattr(init_app, "_init_done", False)

    def worker():
        init_app.init_app_once(env)

    t1 = threading.Thread(target=worker)
    t2 = threading.Thread(target=worker)
    t1.start(); t2.start(); t1.join(); t2.join()
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
