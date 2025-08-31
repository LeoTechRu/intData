from __future__ import annotations

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine as create_sync_engine
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from base import Base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_HOST = os.getenv("DB_HOST")
    DB_NAME = os.getenv("DB_NAME")
    DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"

ENGINE_MODE = "async" if "+asyncpg" in DATABASE_URL else "sync"

if ENGINE_MODE == "async":
    engine: AsyncEngine | Engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
else:
    engine = create_sync_engine(DATABASE_URL, future=True)
    async_session = None


async def init_models() -> None:
    """Create tables for development/testing."""
    if ENGINE_MODE == "async":
        async with engine.begin() as conn:  # type: ignore[arg-type]
            await conn.run_sync(Base.metadata.create_all)
    else:
        with engine.begin() as conn:  # type: ignore[attr-defined]
            Base.metadata.create_all(bind=conn)
