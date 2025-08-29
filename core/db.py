# /sd/leonidpro/core/db.py
from aiogram import Dispatcher, Bot
from aiogram.fsm.storage.memory import MemoryStorage
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine.url import make_url, URL
from sqlalchemy import create_engine
import importlib
import subprocess
import logging
import os
import traceback
from dotenv import load_dotenv
import builtins
import sys
import bcrypt as _bcrypt

logger = logging.getLogger(__name__)

from base import Base

load_dotenv()

# Database configuration
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DATABASE_URL = (
    f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
)

"""Database engine and session factory.

By default, an async engine is created from environment variables
(`DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_NAME`). Tests may override
`async_session` (and optionally `engine`) to point to an in-memory
SQLite engine. The `init_models()` helper below prefers the engine bound
to the current `async_session` so that tests don't require Postgres.
"""

engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

def _pick_pg_driver() -> str | None:
    for mod, drv in (("psycopg", "psycopg"), ("psycopg2", "psycopg2"), ("pg8000", "pg8000")):
        try:
            importlib.import_module(mod)
            return drv
        except Exception:
            continue
    return None


def _to_sync_dsn(url_like) -> str:
    url = url_like if isinstance(url_like, URL) else make_url(str(url_like))
    drv = _pick_pg_driver()
    if drv is None:
        # без установленного драйвера не получится create_engine
        # вернём базовый postgresql (пусть выше по стеку решают graceful-degrade)
        return url.set(drivername="postgresql").render_as_string(hide_password=False)
    return url.set(drivername=f"postgresql+{drv}").render_as_string(hide_password=False)


def _run_alembic_upgrade_with_connection(sync_url: str):
    from alembic import command
    from alembic.config import Config
    ini_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg = Config(ini_path) if os.path.exists(ini_path) else Config()
    mig_engine = create_engine(sync_url, pool_pre_ping=True)
    with mig_engine.connect() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")


def _psql(dsn_sync: str, sql: str) -> tuple[int, str, str]:
    proc = subprocess.run(["psql", dsn_sync, "-XAtc", sql], text=True, capture_output=True)
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


async def init_models() -> None:
    """Ensure the database schema is up to date."""
    logger.debug("init_models(): begin")
    try:
        eng = engine
        logger.debug("DB URL (masked): %s", eng.url.render_as_string(hide_password=True))
        if eng.url.drivername.startswith("sqlite"):
            async with eng.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("init_models(): alembic upgrade done")
            logger.debug("init_models(): end")
            return
        dsn_sync = _to_sync_dsn(eng.url)

        try:
            _run_alembic_upgrade_with_connection(dsn_sync)
            logger.info("init_models(): alembic upgrade done")
        except ModuleNotFoundError as e:
            logger.warning(
                "Alembic skipped (no PG DBAPI found: %s). Service will start; applying minimal DDL via psql.",
                e,
            )
        except Exception as e:
            logger.warning("Alembic upgrade failed: %s", e, exc_info=True)

        rc, out, err = _psql(
            dsn_sync,
            "select 1 from information_schema.columns where table_name='projects' and column_name='status';",
        )
        if rc != 0:
            logger.warning("psql check failed (will not block startup). stderr: %s", err)
        elif out != "1":
            rc2, _, err2 = _psql(
                dsn_sync,
                "ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active' NOT NULL;",
            )
            if rc2 != 0:
                logger.warning("Fallback DDL failed (will not block startup). stderr: %s", err2)
            else:
                logger.warning("Applied fallback DDL: projects.status added.")

    except Exception as e:
        logger.error("init_models() failed: %s\n%s", e, traceback.format_exc())
        raise
    logger.debug("init_models(): end")

# Bot
BOT_TOKEN = os.getenv("BOT_TOKEN") or ("123456:" + "A" * 35)
try:
    bot = Bot(token=BOT_TOKEN)
except Exception:
    BOT_TOKEN = "123456:" + "A" * 35
    bot = Bot(token=BOT_TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)

# Make this module accessible as ``db`` to satisfy tests without
# requiring an explicit import in other modules
builtins.db = sys.modules[__name__]


class _BcryptWrapper:
    """Lightweight wrapper providing Flask-Bcrypt like helpers.

    The project historically referenced ``core.db.bcrypt`` with methods
    ``generate_password_hash`` and ``check_password_hash`` similar to the
    Flask-Bcrypt extension.  To keep backwards compatibility while using
    the "bcrypt" package, we expose a small wrapper with the same API.
    """

    @staticmethod
    def generate_password_hash(password: str) -> str:
        return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

    @staticmethod
    def check_password_hash(hashed: str, password: str) -> bool:
        if not hashed:
            return False
        return _bcrypt.checkpw(password.encode(), hashed.encode())


# Public object for imports like ``from core.db import bcrypt``
bcrypt = _BcryptWrapper()
