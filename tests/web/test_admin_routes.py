import pytest
import pytest_asyncio
from httpx import AsyncClient

from base import Base
from backend.models import WebUser, UserRole, TgUser, WebTgLink
from backend.services.audit_log import AuditLogService
from backend.services.profile_service import ProfileService
from sqlalchemy import select
import backend.db as db
from tests.utils.seeds import ensure_tg_user

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
        async with session.begin():
            service = ProfileService(session)
            await service.ensure_profile(
                entity_type="user",
                entity_id=user.id,
                slug=username,
                display_name=username,
            )
        return user.id


@pytest.mark.asyncio
async def test_profile_access_single_user(client: AsyncClient):
    uid = await _create_user(UserRole.single, username="user1")
    resp = await client.get("/users/user1", headers={"Authorization": f"Bearer {uid}"})
    assert resp.status_code == 200

    legacy = await client.get("/admin", headers={"Authorization": f"Bearer {uid}"})
    assert legacy.status_code == 403

    iframe = await client.get("/cup/admin-embed", headers={"Authorization": f"Bearer {uid}"})
    assert iframe.status_code in {401, 403}


@pytest.mark.asyncio
async def test_admin_access(client: AsyncClient):
    uid = await _create_user(UserRole.admin, username="admin")
    profile = await client.get("/users/admin", headers={"Authorization": f"Bearer {uid}"})
    assert profile.status_code == 200
    legacy = await client.get("/admin", headers={"Authorization": f"Bearer {uid}"})
    assert legacy.status_code == 200

    admin_console = await client.get("/cup/admin-embed", headers={"Authorization": f"Bearer {uid}"})
    assert admin_console.status_code == 200
    assert "Админский сектор" in admin_console.text


@pytest.mark.asyncio
async def test_role_and_link_operations(client: AsyncClient):
    admin_id = await _create_user(UserRole.admin, username="boss")
    user_id = await _create_user(UserRole.single, username="web")
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            tg = await ensure_tg_user(session, 123, first_name="tg")
        tg_id = tg.id
        telegram_id = tg.telegram_id

    headers = {"Authorization": f"Bearer {admin_id}"}

    resp = await client.post(
        f"/api/v1/admin/web/link?web_user_id={user_id}&tg_user_id={tg_id}",
        headers=headers,
    )
    assert resp.status_code == 200

    resp = await client.post(
        f"/api/v1/admin/role/{telegram_id}?role=moderator",
        headers=headers,
    )
    assert resp.status_code == 200
    async with db.async_session() as session:  # type: ignore
        tuser = await session.get(TgUser, tg_id)
        assert tuser.role == UserRole.moderator.name

    resp = await client.post(
        f"/api/v1/admin/web/role/{user_id}?role=moderator",
        headers=headers,
    )
    assert resp.status_code == 200
    async with db.async_session() as session:  # type: ignore
        wuser = await session.get(WebUser, user_id)
        assert wuser.role == UserRole.moderator.name
        res = await session.execute(
            select(WebTgLink).where(
                WebTgLink.web_user_id == user_id,
                WebTgLink.tg_user_id == tg_id,
            )
        )
        assert res.scalar_one_or_none() is not None

    resp = await client.post(
        f"/api/v1/admin/web/unlink?web_user_id={user_id}&tg_user_id={tg_id}",
        headers=headers,
    )
    assert resp.status_code == 200
    async with db.async_session() as session:  # type: ignore
        res = await session.execute(
            select(WebTgLink).where(
                WebTgLink.web_user_id == user_id,
                WebTgLink.tg_user_id == tg_id,
            )
        )
        assert res.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_admin_audit_logs(client: AsyncClient):
    admin_id = await _create_user(UserRole.admin, username="chief")
    target_id = await _create_user(UserRole.single, username="member")

    async with db.async_session() as session:  # type: ignore
        service = AuditLogService(session)
        await service.log_role_assignment(
            actor_user_id=admin_id,
            target_user_id=target_id,
            action="grant_role",
            role_slug="moderator",
            scope_type="global",
            scope_id=None,
            details={"source": "test"},
        )
        await session.commit()

    headers = {"Authorization": f"Bearer {admin_id}"}
    resp = await client.get("/api/v1/admin/audit/logs", headers=headers)
    assert resp.status_code == 200
    payload = resp.json()
    assert payload
    record = payload[0]
    assert record["target"]["id"] == target_id
    assert record["action"] == "grant_role"
