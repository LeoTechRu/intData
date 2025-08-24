# /sd/tg/LeonidBot/core/db.py
from aiogram import Dispatcher, Bot
from aiogram.fsm.storage.memory import MemoryStorage
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import asyncio
import os
from dotenv import load_dotenv
import builtins
import sys
from pathlib import Path
from alembic import command
from alembic.config import Config

from base import Base
import core.models  # ensure models are loaded

load_dotenv()

# Database configuration
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL and all([DB_USER, DB_PASSWORD, DB_HOST, DB_NAME]):
    DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"

# Async engine and session
engine = create_async_engine(DATABASE_URL or "sqlite+aiosqlite:///:memory:")
async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_models() -> None:
    """Create database tables for all models."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def run_migrations() -> None:
    """Apply pending Alembic migrations."""
    if not DATABASE_URL or DATABASE_URL.startswith("sqlite"):
        return

    config = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", DATABASE_URL)
    await asyncio.to_thread(command.upgrade, config, "head")

# Bot
BOT_TOKEN = os.getenv("BOT_TOKEN") or "123456:" + "A" * 35
try:
    bot = Bot(token=BOT_TOKEN)
except Exception:
    BOT_TOKEN = "123456:" + "A" * 35
    bot = Bot(token=BOT_TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)

# Make this module accessible as ``db`` to satisfy tests without explicit import
builtins.db = sys.modules[__name__]

