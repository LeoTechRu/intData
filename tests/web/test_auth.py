import hmac
import hashlib
import os
import time

import pytest
import pytest_asyncio
from httpx import AsyncClient

import core.db as db
from base import Base
from core.services.telegram_user_service import TelegramUserService
from core.services.web_user_service import WebUserService

TG_BOT_TOKEN = "TEST_TOKEN"
os.environ.setdefault("TG_BOT_TOKEN", TG_BOT_TOKEN)
os.environ.setdefault("TG_BOT_USERNAME", "testbot")
from web.config import S  # noqa: E402

try:
    from core.main import app  # type: ignore
except ModuleNotFoundError:  # fallback if app located differently
    from main import app  # type: ignore


def _generate_hash(data: dict) -> str:
    """Generate Telegram auth hash."""
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()) if k != "hash")
    secret_key = hashlib.sha256(TG_BOT_TOKEN.encode()).digest()
    return hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()


@pytest_asyncio.fixture
async def client(postgres_db):
    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    db.TG_BOT_TOKEN = TG_BOT_TOKEN
    S.TG_BOT_TOKEN = TG_BOT_TOKEN
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


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
async def test_telegram_login_validation_get(client: AsyncClient):
    data = {
        "id": 124,
        "first_name": "Test",
        "auth_date": int(time.time()),
    }
    data["hash"] = _generate_hash(data)
    response = await client.get("/auth/tg/callback", params=data)
    assert response.status_code in {200, 303}


@pytest.mark.asyncio
async def test_middleware_redirects(client: AsyncClient):
    """Unauthenticated users should be redirected to login."""
    resp = await client.get("/admin", follow_redirects=False)
    assert resp.status_code in {302, 303, 307}
    assert resp.headers["location"].startswith("/auth?next=")


@pytest.mark.asyncio
async def test_middleware_allows_authenticated(client: AsyncClient):
    """Authenticated users should see the dashboard at root."""
    async with WebUserService() as wsvc:
        user = await wsvc.register(username="u1", password="p1")
    client.cookies.set("web_user_id", str(user.id))
    resp = await client.get("/", follow_redirects=False)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_login_nonexistent_user_creates_account(client: AsyncClient):
    resp = await client.post(
        "/auth/login",
        data={"username": "nope", "password": "bad"},
        follow_redirects=False,
    )
    assert resp.status_code == 303
    assert resp.headers["location"].startswith("/users/nope")


@pytest.mark.asyncio
async def test_login_case_insensitive_existing_user(client: AsyncClient):
    resp1 = await client.post(
        "/auth/login",
        data={"username": "alice", "password": "secret"},
        follow_redirects=False,
    )
    assert resp1.status_code == 303

    resp2 = await client.post(
        "/auth/login",
        data={"username": "ALICE", "password": "secret"},
        follow_redirects=False,
    )
    assert resp2.status_code == 303
    assert resp2.headers["location"] == "/"

    async with WebUserService() as wsvc:
        users = await wsvc.list_users()
    assert len(users) == 1
    assert users[0].username == "alice"


@pytest.mark.asyncio
async def test_login_internal_error_shows_detail(monkeypatch, client: AsyncClient):
    async def broken_auth(self, username: str, password: str):
        raise RuntimeError("DB down")

    monkeypatch.setattr(WebUserService, "authenticate", broken_auth)
    resp = await client.post("/auth/login", data={"username": "u", "password": "p"})
    assert resp.status_code in {303, 500}
    if resp.status_code == 500:
        assert "DB down" in resp.text
    else:
        from urllib.parse import urlparse, parse_qs

        parsed = urlparse(resp.headers["location"])
        params = parse_qs(parsed.query)
        assert params.get("flash") == ["Техническая ошибка. Попробуйте ещё раз позже."]


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
    assert resp.headers["location"] == "/auth"
    assert client.cookies.get("telegram_id") == "999"
    async with TelegramUserService() as tsvc:
        assert await tsvc.get_user_by_telegram_id(999) is not None

    resp2 = await client.post(
        "/auth/login",
        data={"username": "reguser", "password": "pass"},
        follow_redirects=False,
    )
    assert resp2.status_code == 303
    assert resp2.headers["location"].startswith("/users/reguser")
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


@pytest.mark.asyncio
async def test_telegram_login_disabled(monkeypatch, client: AsyncClient):
    monkeypatch.setattr(S._env, "TG_LOGIN_ENABLED", False)
    data = {
        "id": 555,
        "first_name": "Nope",
        "auth_date": int(time.time()),
    }
    data["hash"] = _generate_hash(data)
    resp = await client.post("/auth/tg/callback", data=data)
    assert resp.status_code == 503
