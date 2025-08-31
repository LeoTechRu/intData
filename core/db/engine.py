from __future__ import annotations

import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from base import Base

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"

engine: AsyncEngine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_models() -> None:
    """Create tables for development/testing."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
