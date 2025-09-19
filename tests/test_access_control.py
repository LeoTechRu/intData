import pytest
import pytest_asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from core.models import WebUser, Area, Project, TgUser
from core.services.access_control import AccessControlService, AccessScope


@pytest_asyncio.fixture
async def session(postgres_db):
    engine, session_factory = postgres_db
    async with session_factory() as sess:
        yield sess


@pytest.mark.asyncio
async def test_seed_and_default_permissions(session):
    service = AccessControlService(session)
    await service.seed_presets()
    user = WebUser(username="alice", password_hash="", role="single")
    session.add(user)
    await session.flush()

    effective = await service.list_effective_permissions(user)
    assert effective.has("app.dashboard.view")
    assert not effective.has("app.roles.manage")
    assert effective.has_role("single")


@pytest.mark.asyncio
async def test_grant_and_revoke_role(session):
    service = AccessControlService(session)
    await service.seed_presets()
    user = WebUser(username="bob", password_hash="", role="single")
    session.add(user)
    await session.flush()

    await service.grant_role(target_user_id=user.id, role_slug="moderator")
    effective = await service.list_effective_permissions(user)
    assert effective.has("app.integrations.manage")
    assert not effective.has("app.roles.manage")

    await service.grant_role(target_user_id=user.id, role_slug="admin")
    effective_admin = await service.list_effective_permissions(user)
    assert effective_admin.is_superuser
    assert effective_admin.has("app.roles.manage")

    await service.revoke_role(target_user_id=user.id, role_slug="moderator")
    effective_after = await service.list_effective_permissions(user)
    assert effective_after.is_superuser


async def _ensure_tg(session, telegram_id: int, **kwargs) -> TgUser:
    stmt = sa.select(TgUser).where(TgUser.telegram_id == telegram_id)
    existing = await session.execute(stmt)
    user = existing.scalar_one_or_none()
    if user is None:
        user = TgUser(telegram_id=telegram_id)
        session.add(user)
    for key, value in kwargs.items():
        setattr(user, key, value)
    await session.flush()
    return user


@pytest.mark.asyncio
async def test_scope_inheritance(session):
    service = AccessControlService(session)
    await service.seed_presets()

    tg_owner = await _ensure_tg(session, 101, role="single", first_name="Owner")
    user = WebUser(username="charlie", password_hash="", role="single")
    area = Area(owner_id=tg_owner.telegram_id, name="Ops", title="Ops")
    session.add_all([user, area])
    await session.flush()

    project = Project(
        area_id=area.id,
        owner_id=tg_owner.telegram_id,
        name="Launch",
        description="",
    )
    session.add(project)
    await session.flush()

    await service.grant_role(
        target_user_id=user.id,
        role_slug="moderator",
        scope=AccessScope("project", project.id),
    )

    effective_project = await service.list_effective_permissions(
        user, scope=AccessScope("project", project.id)
    )
    assert effective_project.has("app.integrations.manage")

    effective_global = await service.list_effective_permissions(user)
    assert not effective_global.has("app.integrations.manage")
