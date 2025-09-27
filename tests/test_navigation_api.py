import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

import backend.db as db
from backend.base import Base
from backend.models import UserSettings, WebUser
from backend.settings_store import metadata as settings_metadata
from web.routes.api.navigation import router as navigation_api
from web.dependencies import get_current_web_user


@pytest_asyncio.fixture
async def async_session(monkeypatch, postgres_engine):
    engine = postgres_engine
    async_sessionmaker = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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

    async with async_session() as session:
        async with session.begin():
            session.add(WebUser(id=1, username="nav_user", role="single"))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/navigation/sidebar")
        assert res.status_code == 200
        body = res.json()
        keys = [item["key"] for item in body["items"]]
        assert keys[0] == "overview"
        assert "admin" not in keys
        modules = body["modules"]
        assert any(module["id"] == "control" for module in modules)
        categories = body["categories"]
        assert any(category["id"] == "overview" for category in categories)
        assert all("module" in item and "section_order" in item for item in body["items"])
        assert all("category" in item for item in body["items"])

        snapshot = await client.get("/api/v1/navigation/user-sidebar-layout")
        assert snapshot.status_code == 200
        snapshot_body = snapshot.json()
        assert snapshot_body["version"] == 0
        assert snapshot_body["hasCustom"] is False
        assert snapshot_body["canEditGlobal"] is False
        assert snapshot_body["navVersion"] == 1

        mutation_payload = {
            "payload": {
                "v": 1,
                "items": [
                    {"key": "projects", "position": 1, "hidden": False},
                    {"key": "overview", "position": 2, "hidden": False},
                    {"key": "habits", "position": 3, "hidden": True},
                ],
            },
            "version": snapshot_body["version"],
        }
        res = await client.post("/api/v1/navigation/user-sidebar-layout", json=mutation_payload)
        assert res.status_code == 200
        updated_snapshot = res.json()
        assert updated_snapshot["version"] == 1
        assert updated_snapshot["hasCustom"] is True
        assert updated_snapshot["layout"]["items"][0]["key"] == "projects"
        hidden_map = {item["key"]: item["hidden"] for item in updated_snapshot["layout"]["items"]}
        assert hidden_map["habits"] is True

        conflict_payload = {
            "payload": mutation_payload["payload"],
            "version": snapshot_body["version"],
        }
        conflict = await client.post("/api/v1/navigation/user-sidebar-layout", json=conflict_payload)
        assert conflict.status_code == 409
        conflict_body = conflict.json()
        assert conflict_body["detail"]["currentVersion"] == updated_snapshot["version"]

        reset_payload = {
            "reset": True,
            "version": updated_snapshot["version"],
        }
        reset_res = await client.post("/api/v1/navigation/user-sidebar-layout", json=reset_payload)
        assert reset_res.status_code == 200
        reset_body = reset_res.json()
        assert reset_body["hasCustom"] is False
        assert reset_body["version"] == 0


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

    async with async_session() as session:
        async with session.begin():
            session.add(WebUser(id=2, username="nav_admin", role="admin"))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        perms_state.update({"admin": False, "allow_settings": False})
        forbidden = await client.get("/api/v1/navigation/global-sidebar-layout")
        assert forbidden.status_code == 403

        perms_state.update({"admin": False, "allow_settings": True})
        snapshot = await client.get("/api/v1/navigation/global-sidebar-layout")
        assert snapshot.status_code == 200
        assert snapshot.json()["version"] == 0

        mutation = {
            "payload": {
                "v": 1,
                "items": [
                    {"key": "tasks", "position": 1, "hidden": False},
                    {"key": "overview", "position": 2, "hidden": False},
                ],
            },
            "version": snapshot.json()["version"],
        }
        update = await client.post("/api/v1/navigation/global-sidebar-layout", json=mutation)
        assert update.status_code == 200
        updated = update.json()
        assert updated["version"] == 1
        assert updated["hasCustom"] is True

        res = await client.get("/api/v1/navigation/sidebar")
        assert res.status_code == 200
        keys = [item["key"] for item in res.json()["items"]]
        assert keys[0] == "tasks"

        conflict = await client.post("/api/v1/navigation/global-sidebar-layout", json=mutation)
        assert conflict.status_code == 409
        assert conflict.json()["detail"]["currentVersion"] == updated["version"]
