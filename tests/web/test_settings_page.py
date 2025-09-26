import pytest
import pytest_asyncio
from httpx import AsyncClient

from base import Base
from backend.models import WebUser, UserRole
import backend.db as db

try:
    from backend.main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from main import app  # type: ignore


@pytest_asyncio.fixture
async def client(postgres_db):
    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


async def _create_user(role: UserRole, username: str) -> int:
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            user = WebUser(username=username, role=role.name)
            session.add(user)
        return user.id


@pytest.mark.asyncio
async def test_settings_personal_only_for_regular_user(client: AsyncClient):
    uid = await _create_user(UserRole.single, username="personal")
    resp = await client.get('/settings', headers={'Authorization': f'Bearer {uid}'})
    assert resp.status_code == 200
    body = resp.text
    assert 'Личный пресет' in body
    assert 'data-testid="settings-admin-marker"' in body
    assert 'data-role="admin"' not in body
    assert 'data-global="true"' not in body


@pytest.mark.asyncio
async def test_settings_admin_sections_visible(client: AsyncClient):
    uid = await _create_user(UserRole.admin, username="architect")
    resp = await client.get('/settings', headers={'Authorization': f'Bearer {uid}'})
    assert resp.status_code == 200
    body = resp.text
    assert 'data-testid="settings-admin-marker"' in body
    assert 'data-role="admin"' in body
    assert 'data-global="true"' in body
