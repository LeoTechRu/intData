import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
import core.db as db
import core.models  # ensure models loaded
import core.settings_store as settings_store
from main import app


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine('sqlite+aiosqlite:///:memory:?cache=shared')
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(settings_store.metadata.create_all)
    db.engine = engine
    db.async_session = async_session
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    await engine.dispose()


@pytest.mark.asyncio
async def test_swagger_ui_served(client: AsyncClient):
    resp = await client.get('/api')
    assert resp.status_code == 200
    assert 'Swagger UI' in resp.text
    js = await client.get('/api/swagger-ui-bundle.js')
    assert not js.is_redirect
