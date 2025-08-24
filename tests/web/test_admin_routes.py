import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from core.models import WebUser, UserRole
import core.db as db

try:
    from core.main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from main import app  # type: ignore


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine('sqlite+aiosqlite:///:memory:?cache=shared')
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    db.engine = engine
    db.async_session = async_session
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    await engine.dispose()


async def _create_user(role: UserRole, username: str) -> int:
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            user = WebUser(username=username, role=role.name)
            session.add(user)
        return user.id


@pytest.mark.asyncio
async def test_profile_access_single_user(client: AsyncClient):
    uid = await _create_user(UserRole.single, username="user1")
    resp = await client.get("/profile/user1", headers={"Authorization": f"Bearer {uid}"})
    assert resp.status_code == 200

    admin = await client.get("/admin", headers={"Authorization": f"Bearer {uid}"})
    assert admin.status_code in {401, 403}


@pytest.mark.asyncio
async def test_admin_access(client: AsyncClient):
    uid = await _create_user(UserRole.admin, username="admin")
    profile = await client.get("/profile/admin", headers={"Authorization": f"Bearer {uid}"})
    assert profile.status_code == 200
    admin = await client.get("/admin", headers={"Authorization": f"Bearer {uid}"})
    assert admin.status_code == 200
