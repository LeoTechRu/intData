from __future__ import annotations

import logging
import sqlalchemy as sa
from sqlalchemy.engine import Connection

from .bootstrap import run_bootstrap_sql
from .repair import run_repair
from .engine import engine, ENGINE_MODE, Base

logger = logging.getLogger(__name__)

_inited = False


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
    global _inited
    if _inited:
        return
    if ENGINE_MODE == "async":
        async with engine.connect() as aconn:  # type: ignore[arg-type]
            await aconn.run_sync(_bootstrap_and_repair_sync, env)
    else:
        with engine.connect() as conn:  # type: ignore[call-arg]
            _bootstrap_and_repair_sync(conn, env)
    _inited = True


def _bootstrap_and_repair_sync(conn: Connection, env) -> None:
    key = 0x5EED1DB
    have_lock = _advisory_lock(conn, key)
    if not have_lock:
        return
    try:
        logger.info("init_app_once: ENGINE_MODE=%s", ENGINE_MODE)
        did_bootstrap = False
        if env.DB_BOOTSTRAP:
            stats = run_bootstrap_sql(conn)
            logger.info(
                "bootstrap summary: files=%s executed=%s failed=%s",
                stats["files"],
                stats["executed"],
                stats["failed"],
            )
            did_bootstrap = True
        if env.DB_REPAIR:
            run_repair(conn)
        if env.DEV_INIT_MODELS and not did_bootstrap:
            _create_models(conn)
    except Exception as e:  # pragma: no cover - log and continue
        logger.exception("bootstrap fatal: %s", e)
    finally:
        _advisory_unlock(conn, key)
    conn.exec_driver_sql("SELECT 1")
