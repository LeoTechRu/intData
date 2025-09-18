import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

import core.db as db
from core.models import UserSettings, WebUser
from core.settings_store import metadata as settings_metadata
from web.routes.api.navigation import router as navigation_api
from web.dependencies import get_current_web_user


@pytest_asyncio.fixture
async def async_session(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_sessionmaker = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: UserSettings.__table__.create(sync_conn, checkfirst=True))
        await conn.run_sync(lambda sync_conn: settings_metadata.create_all(sync_conn))
    had_engine = hasattr(db, "engine")
    original_engine = getattr(db, "engine", None)
    db.engine = engine  # type: ignore[attr-defined]
    had_async_session = hasattr(db, "async_session")
    original_async_session = getattr(db, "async_session", None)
    monkeypatch.setattr(db, "async_session", lambda: async_sessionmaker())
    try:
        yield async_sessionmaker
    finally:
        if had_engine:
            db.engine = original_engine
        else:
            delattr(db, "engine")
        if had_async_session:
            db.async_session = original_async_session
        else:
            delattr(db, "async_session")


class FakeEffective:
    def __init__(self, *, admin: bool = False, allow_settings: bool = False):
        self._admin = admin
        self._allow_settings = allow_settings

    def has(self, code: str) -> bool:
        if code == "app.settings.manage":
            return self._allow_settings
        return True

    def has_all(self, codes):
        return all(self.has(code) for code in codes)

    def has_role(self, role: str) -> bool:
        if role == "admin":
            return self._admin
        return False


@pytest.mark.asyncio
async def test_navigation_user_layout(monkeypatch, async_session):
    app = FastAPI()
    app.include_router(navigation_api, prefix="/api/v1")

    def override_user():
        return WebUser(id=1, username="nav_user", role="single")

    app.dependency_overrides[get_current_web_user] = override_user

    async def fake_permissions(request, current_user=None):
        return FakeEffective(admin=False, allow_settings=False)

    monkeypatch.setattr(
        "web.routes.api.navigation.get_effective_permissions",
        fake_permissions,
    )

    client = TestClient(app)

    res = client.get("/api/v1/navigation/sidebar")
    assert res.status_code == 200
    body = res.json()
    keys = [item["key"] for item in body["items"]]
    assert keys[0] == "overview"
    assert "admin" not in keys

    payload = {
        "layout": {
            "v": 1,
            "items": [
                {"key": "projects", "position": 1, "hidden": False},
                {"key": "overview", "position": 2, "hidden": False},
                {"key": "habits", "position": 3, "hidden": True},
            ],
        }
    }
    res = client.put("/api/v1/navigation/sidebar/user", json=payload)
    assert res.status_code == 200
    updated = res.json()["payload"]
    assert updated["items"][0]["key"] == "projects"
    hidden_map = {item["key"]: item["hidden"] for item in updated["items"]}
    assert hidden_map["habits"] is True

    res = client.put("/api/v1/navigation/sidebar/user", json={"reset": True})
    assert res.status_code == 200
    reset_payload = res.json()["payload"]
    assert reset_payload["items"][0]["key"] == "overview"
    hidden_map = {item["key"]: item["hidden"] for item in reset_payload["items"]}
    assert hidden_map.get("habits") is False


@pytest.mark.asyncio
async def test_navigation_global_requires_permission(monkeypatch, async_session):
    app = FastAPI()
    app.include_router(navigation_api, prefix="/api/v1")

    def override_user():
        return WebUser(id=2, username="nav_admin", role="admin")

    app.dependency_overrides[get_current_web_user] = override_user

    perms_state = {"admin": True, "allow_settings": False}

    async def fake_permissions(request, current_user=None):
        return FakeEffective(
            admin=perms_state["admin"], allow_settings=perms_state["allow_settings"]
        )

    monkeypatch.setattr(
        "web.routes.api.navigation.get_effective_permissions",
        fake_permissions,
    )

    client = TestClient(app)
    # Without settings permission, even admin role must be true to pass
    perms_state.update({"admin": False, "allow_settings": False})
    res = client.put(
        "/api/v1/navigation/sidebar/global",
        json={"layout": {"v": 1, "items": []}},
    )
    assert res.status_code == 403

    # Allow settings permission
    perms_state.update({"admin": False, "allow_settings": True})
    payload = {
        "layout": {
            "v": 1,
            "items": [
                {"key": "tasks", "position": 1, "hidden": False},
                {"key": "overview", "position": 2, "hidden": False},
            ],
        }
    }
    res = client.put("/api/v1/navigation/sidebar/global", json=payload)
    assert res.status_code == 200

    res = client.get("/api/v1/navigation/sidebar")
    assert res.status_code == 200
    keys = [item["key"] for item in res.json()["items"]]
    assert keys[0] == "tasks"
