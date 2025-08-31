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


def _create_models(conn: Connection) -> None:
    Base.metadata.create_all(bind=conn)

async def init_app_once(env) -> None:
    """One-stop database initialization for web and bot processes."""
    global _init_done
    if _init_done:
        return
    if not (env.DB_BOOTSTRAP or env.DB_REPAIR or env.DEV_INIT_MODELS):
        _init_done = True
        return
    async with engine.begin() as conn:
        key = 0x5EED1DB
        have_lock = await conn.run_sync(_advisory_lock, key)
        if not have_lock:
            return
        try:
            did_bootstrap = False
            if env.DB_BOOTSTRAP:
                await conn.run_sync(run_bootstrap_sql)
                did_bootstrap = True
            if env.DB_REPAIR:
                await conn.run_sync(run_repair)
            if env.DEV_INIT_MODELS and not did_bootstrap:
                await conn.run_sync(_create_models)
        finally:
            await conn.run_sync(_advisory_unlock, key)
    _init_done = True
