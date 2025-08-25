import hmac
import hashlib
import os
import time

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

import core.db as db
from base import Base
from core.services.telegram_user_service import TelegramUserService
from core.services.web_user_service import WebUserService

BOT_TOKEN = "TEST_TOKEN"
os.environ.setdefault("BOT_TOKEN", BOT_TOKEN)
os.environ.setdefault("TELEGRAM_BOT_USERNAME", "testbot")
from web.config import S  # noqa: E402

try:
    from core.main import app  # type: ignore
except ModuleNotFoundError:  # fallback if app located differently
    from main import app  # type: ignore


def _generate_hash(data: dict) -> str:
    """Generate Telegram auth hash."""
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()) if k != "hash")
    secret_key = hashlib.sha256(BOT_TOKEN.encode()).digest()
    return hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    db.async_session = async_session
    db.BOT_TOKEN = BOT_TOKEN
    S.BOT_TOKEN = BOT_TOKEN
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    await engine.dispose()


@pytest.mark.asyncio
async def test_telegram_login_validation(client: AsyncClient):
    data = {
        "id": 123,
        "first_name": "Test",
        "auth_date": int(time.time()),
    }
    data["hash"] = _generate_hash(data)
    response = await client.post("/auth/tg/callback", data=data)
    assert response.status_code in {200, 303}

    data["hash"] = "invalid"
    bad = await client.post("/auth/tg/callback", data=data)
    assert bad.status_code in {400, 401, 403}


@pytest.mark.asyncio
async def test_middleware_redirects(client: AsyncClient):
    """Unauthenticated users should be redirected to login."""
    resp = await client.get("/admin", follow_redirects=False)
    assert resp.status_code in {302, 303, 307}
    assert resp.headers["location"].startswith("/auth/login?next=")


@pytest.mark.asyncio
async def test_middleware_allows_authenticated(client: AsyncClient):
    """Authenticated users should see the dashboard at root."""
    client.cookies.set("telegram_id", "1")
    resp = await client.get("/", follow_redirects=False)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_login_invalid_credentials_shows_error(client: AsyncClient):
    resp = await client.post("/auth/login", data={"username": "nope", "password": "bad"})
    assert resp.status_code == 400
    assert "Invalid credentials" in resp.text


@pytest.mark.asyncio
async def test_login_internal_error_shows_detail(monkeypatch, client: AsyncClient):
    async def broken_auth(self, username: str, password: str):
        raise RuntimeError("DB down")

    monkeypatch.setattr(WebUserService, "authenticate", broken_auth)
    resp = await client.post("/auth/login", data={"username": "u", "password": "p"})
    assert resp.status_code == 500
    assert "DB down" in resp.text


@pytest.mark.asyncio
async def test_telegram_registration_flow(client: AsyncClient):
    data = {
        "id": 999,
        "first_name": "Reg",
        "auth_date": int(time.time()),
    }
    data["hash"] = _generate_hash(data)
    resp = await client.post("/auth/tg/callback", data=data)
    assert resp.status_code == 303
    assert resp.headers["location"] == "/auth/create_web_account"
    assert client.cookies.get("telegram_id") == "999"
    async with TelegramUserService() as tsvc:
        assert await tsvc.get_user_by_telegram_id(999) is not None

    resp2 = await client.post(
        "/auth/create_web_account",
        data={"action": "create", "username": "reguser", "password": "pass"},
    )
    assert resp2.status_code == 303
    assert resp2.headers["location"] == "/"
    assert client.cookies.get("web_user_id") is not None
    assert client.cookies.get("telegram_id") == "999"

    resp3 = await client.get("/")
    assert resp3.status_code == 200


@pytest.mark.asyncio
async def test_telegram_login_existing_user(client: AsyncClient):
    async with TelegramUserService() as tsvc:
        tg_user, _ = await tsvc.get_or_create_user(telegram_id=321, first_name="Foo")
    async with WebUserService() as wsvc:
        web_user = await wsvc.register(username="foo", password="bar")
        await wsvc.link_telegram(web_user.id, tg_user.id)

    data = {
        "id": 321,
        "first_name": "Foo",
        "auth_date": int(time.time()),
    }
    data["hash"] = _generate_hash(data)
    resp = await client.post("/auth/tg/callback", data=data)
    assert resp.status_code == 303
    assert resp.headers["location"] == "/"
    assert client.cookies.get("telegram_id") == "321"
    assert client.cookies.get("web_user_id") == str(web_user.id)

    resp2 = await client.get("/")
    assert resp2.status_code == 200
