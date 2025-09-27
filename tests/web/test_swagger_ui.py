import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from backend.base import Base
import backend.db as db
import backend.models  # ensure models loaded
import backend.settings_store as settings_store
from orchestrator.main import app


@pytest_asyncio.fixture
async def client(postgres_db):
    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(settings_store.metadata.create_all)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_swagger_ui_served(client: AsyncClient):
    resp = await client.get('/api')
    assert resp.status_code == 200
    assert 'Swagger UI' in resp.text
    js = await client.get('/api/swagger-ui-bundle.js')
    assert not js.is_redirect
