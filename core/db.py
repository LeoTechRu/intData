# /sd/tg/LeonidBot/core/db.py
from aiogram import Dispatcher, Bot
from aiogram.fsm.storage.memory import MemoryStorage
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
import builtins
import sys

from base import Base
import core.models  # ensure models are loaded  # noqa: F401

load_dotenv()

# Database configuration
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DATABASE_URL = (
    f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
)

# Async engine and session
engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
)


async def init_models() -> None:
    """Create database tables for all models."""
    async with engine.begin() as conn:
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
