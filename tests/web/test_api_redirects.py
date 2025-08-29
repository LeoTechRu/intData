import subprocess
import json

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
import core.db as db
from main import app
import core.models  # ensure models are loaded
import core.settings_store as settings_store


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine('sqlite+aiosqlite:///:memory:?cache=shared')
    async_session = sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(settings_store.metadata.create_all)
    db.engine = engine
    db.async_session = async_session
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    await engine.dispose()


@pytest.mark.asyncio
async def test_old_path_redirects(client: AsyncClient):
    resp = await client.get('/api/app-settings?prefix=ui.persona.')
    assert resp.status_code in (307, 308)
    loc = resp.headers['location']
    assert loc.startswith('/api/v1/')
    resp2 = await client.get(loc)
    assert resp2.status_code == 200


def test_no_old_api_hardcodes():
    res = subprocess.run(
        ['rg', '-n', '-P', '/api/(?!v1)', 'web/static/js'],
        capture_output=True,
        text=True,
    )
    assert res.returncode == 1, f'Old API paths found: {res.stdout}'

