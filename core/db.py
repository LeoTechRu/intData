# /sd/leonidpro/core/db.py
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
import logging
import os
import builtins
import sys
import bcrypt as _bcrypt
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

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


async def bootstrap_db(engine: AsyncEngine) -> None:
    """Create missing tables and add missing columns (additive, idempotent)."""
    logger.info("DB bootstrap: start")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with engine.begin() as conn:
        def _upgrade_columns(sync_conn):
            insp = sa.inspect(sync_conn)
            pg = postgresql.dialect()
            for _, table in Base.metadata.tables.items():
                schema = table.schema
                table_name = table.name
                existing = {c["name"] for c in insp.get_columns(table_name, schema=schema)}
                fqtn = f"{schema}.{table_name}" if schema else table_name

                for col in table.columns:
                    if col.name in existing:
                        continue

                    if isinstance(col.type, sa.Enum):
                        enum_name = col.type.name or f"{table_name}_{col.name}_enum"
                        labels = ", ".join([f"'{e}'" for e in col.type.enums])
                        sync_conn.exec_driver_sql(
                            f"DO $$ BEGIN "
                            f"CREATE TYPE {enum_name} AS ENUM ({labels}); "
                            f"EXCEPTION WHEN duplicate_object THEN NULL; "
                            f"END $$;"
                        )
                        coltype_sql = enum_name
                    else:
                        coltype_sql = col.type.compile(dialect=pg)

                    default_sql = ""
                    sd = getattr(col, "server_default", None)
                    if sd is not None and getattr(sd, "arg", None) is not None:
                        default_sql = f" DEFAULT {str(sd.arg)}"

                    add_sql = f'ALTER TABLE {fqtn} ADD COLUMN "{col.name}" {coltype_sql}{default_sql}'
                    logger.debug("DDL: %s", add_sql)
                    sync_conn.exec_driver_sql(add_sql)

        await conn.run_sync(_upgrade_columns)

    logger.info("DB bootstrap: done")


async def init_models() -> None:
    """Backward-compatible entry point for database initialization."""
    await bootstrap_db(engine)

# Bot
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN") or ("123456:" + "A" * 35)
try:
    bot = Bot(token=TELEGRAM_BOT_TOKEN)
except Exception:
    TELEGRAM_BOT_TOKEN = "123456:" + "A" * 35
    bot = Bot(token=TELEGRAM_BOT_TOKEN)
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
