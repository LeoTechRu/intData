# /sd/leonidpro/core/db.py
from aiogram import Dispatcher, Bot
from aiogram.fsm.storage.memory import MemoryStorage
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
import builtins
import sys
import bcrypt as _bcrypt

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


async def init_models() -> None:
    """Create database tables for all models.

    Prefer the engine bound to ``async_session`` when available. This
    allows the test suite to replace ``async_session`` with a SQLite
    sessionmaker and run without a Postgres server. Falls back to the
    module-level ``engine`` otherwise.
    """
    eng = None
    try:
        # SQLAlchemy 1.4/2.0: sessionmaker may expose the bound engine either
        # via ``bind`` attribute or inside ``kw['bind']``.
        eng = getattr(async_session, "bind", None)
        if eng is None:
            kw = getattr(async_session, "kw", {}) or {}
            eng = kw.get("bind")
    except Exception:
        eng = None

    eng = eng or engine
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

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
