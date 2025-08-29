import json
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
import core.db as db
from core.models import WebUser, UserRole
from core.settings_store import metadata
from main import app


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine('sqlite+aiosqlite:///:memory:?cache=shared')
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(metadata.create_all)
    db.engine = engine
    db.async_session = async_session
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    await engine.dispose()


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
    assert data['entries']['ui.persona.personal_brain.label.ru'] == 'Личный мозг'
    etag = resp.headers['ETag']
    resp2 = await client.get('/api/v1/app-settings?prefix=ui.persona.', headers={'If-None-Match': etag})
    assert resp2.status_code == 304


@pytest.mark.asyncio
async def test_put_settings(client: AsyncClient):
    admin_id = await _create_admin()
    payload = {"entries": {"ui.persona.personal_brain.label.ru": "Новый мозг"}}
    resp = await client.put('/api/v1/app-settings', json=payload, headers={'Authorization': f'Bearer {admin_id}'})
    assert resp.status_code == 200
    resp_get = await client.get('/api/v1/app-settings?prefix=ui.persona.')
    assert resp_get.json()['entries']['ui.persona.personal_brain.label.ru'] == 'Новый мозг'


@pytest.mark.asyncio
async def test_put_validation(client: AsyncClient):
    admin_id = await _create_admin()
    bad = {"entries": {"ui.persona.personal_brain.label.ru": "<bad>"}}
    resp = await client.put('/api/v1/app-settings', json=bad, headers={'Authorization': f'Bearer {admin_id}'})
    assert resp.status_code == 400
