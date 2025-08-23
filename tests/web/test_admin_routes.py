import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from models import User, UserRole
import db

try:
    from src.main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from main import app  # type: ignore


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    db.async_session = async_session
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    await engine.dispose()


async def _create_user(role: UserRole, telegram_id: int) -> None:
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            session.add(User(id=telegram_id, telegram_id=telegram_id, first_name="T", role=role.value))


@pytest.mark.asyncio
async def test_profile_access_single_user(client: AsyncClient):
    await _create_user(UserRole.single, telegram_id=1)
    resp = await client.get("/profile/1", headers={"Authorization": "Bearer 1"})
    assert resp.status_code == 200

    admin = await client.get("/admin/users", headers={"Authorization": "Bearer 1"})
    assert admin.status_code in {401, 403}


@pytest.mark.asyncio
async def test_admin_access(client: AsyncClient):
    await _create_user(UserRole.admin, telegram_id=2)
    profile = await client.get("/profile/2", headers={"Authorization": "Bearer 2"})
    assert profile.status_code == 200
    admin = await client.get("/admin/users", headers={"Authorization": "Bearer 2"})
    assert admin.status_code == 200
