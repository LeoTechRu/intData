import os
import secrets
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault('TG_BOT_TOKEN', 'TEST_TOKEN')
os.environ.setdefault('TG_BOT_USERNAME', 'testbot')

from base import Base  # noqa: E402


def _build_async_url(schema: str) -> str:
    base_url = os.getenv('DATABASE_URL')
    if not base_url:
        user = os.getenv('DB_USER', '')
        password = os.getenv('DB_PASSWORD', '')
        host = os.getenv('DB_HOST', 'localhost')
        port = os.getenv('DB_PORT', '5432')
        name = os.getenv('DB_NAME', '')
        base_url = f'postgresql+asyncpg://{user}:{password}@{host}:{port}/{name}'
    parts = urlsplit(base_url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    extra = f'-csearch_path={schema},public'
    options = query.get('options')
    query['options'] = (f"{options} {extra}" if options else extra).strip()
    new_query = urlencode(query, doseq=True)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))


def _build_sync_url() -> str:
    base_url = os.getenv('DATABASE_URL')
    if base_url:
        sync_url = base_url.replace('+asyncpg', '')
    else:
        user = os.getenv('DB_USER', '')
        password = os.getenv('DB_PASSWORD', '')
        host = os.getenv('DB_HOST', 'localhost')
        port = os.getenv('DB_PORT', '5432')
        name = os.getenv('DB_NAME', '')
        sync_url = f'postgresql://{user}:{password}@{host}:{port}/{name}'
    parts = urlsplit(sync_url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, '', parts.fragment))


@pytest_asyncio.fixture(scope='function')
async def session():
    schema = f'test_{secrets.token_hex(4)}'
    sync_url = _build_sync_url()
    with psycopg.connect(sync_url) as conn:
        conn.execute(f'CREATE SCHEMA "{schema}"')
    async_url = _build_async_url(schema)
    engine = create_async_engine(async_url, future=True)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        Session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
        async with Session() as sess:
            yield sess
            await sess.rollback()
    finally:
        await engine.dispose()
        with psycopg.connect(sync_url) as conn:
            conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
