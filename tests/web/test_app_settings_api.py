import json
import pytest
import pytest_asyncio
from httpx import AsyncClient

from base import Base
import backend.db as db
from backend.models import WebUser, UserRole
from backend.settings_store import metadata
from main import app


@pytest_asyncio.fixture
async def client(postgres_db):
    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(metadata.create_all)
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


async def _create_admin() -> int:
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            u = WebUser(username='u', role=UserRole.admin.name)
            session.add(u)
    return u.id  # type: ignore


@pytest.mark.asyncio
async def test_get_defaults_etag(client: AsyncClient):
    resp = await client.get('/api/v1/app-settings?prefix=ui.persona.')
    assert resp.status_code == 200
    data = resp.json()
    assert data['entries']['ui.persona.single.label.ru'] == 'Второй мозг'
    etag = resp.headers['ETag']
    resp2 = await client.get('/api/v1/app-settings?prefix=ui.persona.', headers={'If-None-Match': etag})
    assert resp2.status_code == 304


@pytest.mark.asyncio
async def test_put_settings(client: AsyncClient):
    admin_id = await _create_admin()
    payload = {"entries": {"ui.persona.single.label.ru": "Новый мозг"}}
    resp = await client.put('/api/v1/app-settings', json=payload, headers={'Authorization': f'Bearer {admin_id}'})
    assert resp.status_code == 200
    resp_get = await client.get('/api/v1/app-settings?prefix=ui.persona.')
    assert resp_get.json()['entries']['ui.persona.single.label.ru'] == 'Новый мозг'


@pytest.mark.asyncio
async def test_put_validation(client: AsyncClient):
    admin_id = await _create_admin()
    bad = {"entries": {"ui.persona.single.label.ru": "<bad>"}}
    resp = await client.put('/api/v1/app-settings', json=bad, headers={'Authorization': f'Bearer {admin_id}'})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reset_prefix(client: AsyncClient):
    admin_id = await _create_admin()
    prefix = 'theme.global.'
    # set custom value
    payload = {"entries": {f"{prefix}primary": "#123456"}}
    resp = await client.put('/api/v1/app-settings', json=payload, headers={'Authorization': f'Bearer {admin_id}'})
    assert resp.status_code == 200
    resp_get = await client.get(f'/api/v1/app-settings?prefix={prefix}')
    assert resp_get.json()['entries'][f'{prefix}primary'] == '#123456'

    # reset back to defaults
    reset_payload = {"entries": {}, "reset_prefix": prefix}
    resp_reset = await client.put('/api/v1/app-settings', json=reset_payload, headers={'Authorization': f'Bearer {admin_id}'})
    assert resp_reset.status_code == 200
    resp_after = await client.get(f'/api/v1/app-settings?prefix={prefix}')
    assert f'{prefix}primary' not in resp_after.json()['entries']


@pytest.mark.asyncio
async def test_put_requires_changes(client: AsyncClient):
    admin_id = await _create_admin()
    resp = await client.put(
        '/api/v1/app-settings',
        json={"entries": {}},
        headers={'Authorization': f'Bearer {admin_id}'},
    )
    assert resp.status_code == 400
