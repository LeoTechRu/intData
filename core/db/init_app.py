from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.engine import Connection

from .bootstrap import run_bootstrap_sql
from .repair import run_repair
from .engine import engine, Base

_init_done = False


def _advisory_lock(conn: Connection, key: int) -> bool:
    try:
        return conn.execute(sa.text("SELECT pg_try_advisory_lock(:k)"), {"k": key}).scalar()
    except Exception:
        return True


def _advisory_unlock(conn: Connection, key: int) -> None:
    try:
        conn.execute(sa.text("SELECT pg_advisory_unlock(:k)"), {"k": key})
    except Exception:
        pass


def create_models_for_dev() -> None:
    Base.metadata.create_all(bind=engine.sync_engine)


def init_app_once(env) -> None:
    """One-stop database initialization for web and bot processes."""
    global _init_done
    if _init_done:
        return
    if not (env.DB_BOOTSTRAP or env.DB_REPAIR or env.DEV_INIT_MODELS):
        _init_done = True
        return
    with engine.sync_engine.begin() as conn:
        key = 0x5EED1DB
        have_lock = _advisory_lock(conn, key)
        if not have_lock:
            return
        try:
            did_bootstrap = False
            if env.DB_BOOTSTRAP:
                run_bootstrap_sql(conn)
                did_bootstrap = True
            if env.DB_REPAIR:
                run_repair(conn)
            if env.DEV_INIT_MODELS and not did_bootstrap:
                create_models_for_dev()
        finally:
            _advisory_unlock(conn, key)
    _init_done = True
