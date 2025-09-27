import subprocess
import json
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from backend.base import Base
import backend.db as db
from orchestrator.main import app
import backend.models  # ensure models are loaded
import backend.settings_store as settings_store


@pytest_asyncio.fixture
async def client(postgres_db):
    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(settings_store.metadata.create_all)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_old_path_redirects(client: AsyncClient):
    resp = await client.get('/api/app-settings?prefix=ui.persona.', follow_redirects=False)
    assert resp.status_code == 308
    assert resp.headers['location'].startswith('/api/v1/app-settings')
    resp2 = await client.get('/api/v1/app-settings?prefix=ui.persona.')
    assert resp2.status_code == 200


def test_no_old_api_hardcodes():
    targets = [
        Path('apps/web/app'),
        Path('apps/web/components'),
        Path('apps/web/lib'),
        Path('apps/web/static'),
    ]
    existing_targets = [str(path) for path in targets if path.exists()]
    assert existing_targets, 'Static analysis targets are missing'
    command = [
        'rg',
        '-n',
        '-P',
        '/api/(?!v1)',
        '-g',
        '*.js',
        '-g',
        '*.ts',
        '-g',
        '*.tsx',
    ] + existing_targets
    res = subprocess.run(command, capture_output=True, text=True)
    assert res.returncode == 1, f'Old API paths found: {res.stdout}'
