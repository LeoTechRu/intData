import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from core.services.telegram_user_service import TelegramUserService
from core.services.web_user_service import WebUserService
from core.models import WebUser


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session = sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )
    async with async_session() as sess:
        yield sess


@pytest.mark.asyncio
async def test_registration_and_auth(session):
    service = WebUserService(session)
    user = await service.register(username="alice", password="secret")
    assert user.id is not None
    auth = await service.authenticate("alice", "secret")
    assert auth is not None
    assert await service.authenticate("alice", "bad") is None


@pytest.mark.asyncio
async def test_authenticate_uses_check_password(monkeypatch, session):
    service = WebUserService(session)
    user = await service.register(username="alice", password="secret")

    called = False

    def fake_check(self, password):  # pragma: no cover - dummy function
        nonlocal called
        called = True
        return True

    monkeypatch.setattr(WebUser, "check_password", fake_check)
    auth = await service.authenticate("alice", "secret")
    assert auth == user
    assert called


@pytest.mark.asyncio
async def test_binding_flow(session):
    tsvc = TelegramUserService(session)
    tg_user = await tsvc.update_from_telegram(telegram_id=123, username="tg")
    tg_user2 = await tsvc.update_from_telegram(telegram_id=456, username="tg2")
    wsvc = WebUserService(session)
    web_user = await wsvc.register(username="alice", password="secret")
    await wsvc.link_telegram(web_user.id, tg_user.id)
    await wsvc.link_telegram(web_user.id, tg_user.id)
    await wsvc.link_telegram(web_user.id, tg_user2.id)
    users = await wsvc.list_users()
    loaded = next(u for u in users if u.id == web_user.id)
    assert {u.telegram_id for u in loaded.telegram_accounts} == {123, 456}
    other = await wsvc.register(username="bob", password="x")
    with pytest.raises(ValueError):
        await wsvc.link_telegram(other.id, tg_user.id)
    await wsvc.unlink_telegram(web_user.id, tg_user.id)
    assert await wsvc.get_user_by_identifier(123) is None


@pytest.mark.asyncio
async def test_update_profile_and_lookup(session):
    wsvc = WebUserService(session)
    tsvc = TelegramUserService(session)
    tg_user = await tsvc.update_from_telegram(telegram_id=555, username="tg")
    user = await wsvc.register(username="alice", password="secret")
    await wsvc.link_telegram(user.id, tg_user.id)
    await wsvc.update_profile(user.id, {"birthday": "2001-01-02"})
    assert str(user.birthday) == "2001-01-02"
    await wsvc.update_profile(user.id, {"birthday": "02.01.2001"})
    assert str(user.birthday) == "2001-01-02"
    by_id = await wsvc.get_user_by_identifier("alice")
    assert by_id.id == user.id
    by_tg = await wsvc.get_user_by_identifier(555)
    assert by_tg.id == user.id


@pytest.mark.asyncio
async def test_ensure_test_user(session):
    wsvc = WebUserService(session)
    pwd = await wsvc.ensure_test_user()
    assert pwd is not None
    again = await wsvc.ensure_test_user()
    assert again is None
