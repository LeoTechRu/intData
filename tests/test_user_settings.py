from pathlib import Path

import json
from pathlib import Path

import pytest
import sqlalchemy as sa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

import core.db as db
from base import Base
from core.services.user_settings_service import UserSettingsService
from core.services.web_user_service import WebUserService
from core.db.repair import run_repair
from web.routes.api_user_settings import router as settings_router
from web.dependencies import get_current_web_user
from core.models import WebUser


@pytest.mark.asyncio
async def test_service_upsert_and_get():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as session:
        wsvc = WebUserService(session)
        user = await wsvc.register(username="u_settings", password="pw")
        data = {"v": 1, "items": []}
        svc = UserSettingsService(session)
        await svc.upsert(user.id, "favorites", data)
        loaded = await svc.get(user.id, "favorites")
        assert loaded == data

        # second upsert should update existing record without IntegrityError
        data2 = {"v": 2, "items": [{"label": "A", "path": "/a", "position": 1}]}
        await svc.upsert(user.id, "favorites", data2)
        loaded = await svc.get(user.id, "favorites")
    assert loaded == data2


def test_repair_migrates_favorites():
    eng = sa.create_engine("sqlite:///:memory:")
    with eng.connect() as conn:
        conn.execute(sa.text("CREATE TABLE users_web(id INTEGER PRIMARY KEY)")).close()
        conn.execute(
            sa.text(
                "CREATE TABLE users_favorites(owner_id INTEGER,label TEXT,path TEXT,position INTEGER)"
            )
        ).close()
        conn.execute(
            sa.text(
                "CREATE TABLE user_settings(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,key VARCHAR(64),value JSON,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,key))"
            )
        ).close()
        conn.execute(sa.text("INSERT INTO users_web(id) VALUES (1)"))
        conn.execute(
            sa.text(
                "INSERT INTO users_favorites(owner_id,label,path,position) VALUES (1,'X','/x',1)"
            )
        )
        run_repair(conn)
        res = conn.execute(
            sa.text(
                "SELECT value FROM user_settings WHERE user_id=1 AND key='favorites'"
            )
        ).scalar()
    assert json.loads(res)["items"][0]["path"] == "/x"


@pytest.mark.asyncio
async def test_api_defaults_and_put(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    monkeypatch.setattr(db, "async_session", lambda: async_session())

    async with async_session() as session:
        wsvc = WebUserService(session)
        user = await wsvc.register(username="u_api", password="pw")

    app = FastAPI()
    app.include_router(settings_router, prefix="/api/v1")

    def override_user():
        return WebUser(id=user.id, username="u_api")

    app.dependency_overrides[get_current_web_user] = override_user
    class FakeEffective:
        def has(self, _perm: str) -> bool:
            return True

        def has_role(self, _role: str) -> bool:
            return True

    async def fake_permissions(request, current_user=None):
        return FakeEffective()

    monkeypatch.setattr(
        "web.routes.api_user_settings.get_effective_permissions",
        fake_permissions,
    )
    client = TestClient(app)

    res = client.get("/api/v1/user/settings")
    assert res.status_code == 200
    body = res.json()
    assert "dashboard_layout" in body and body["favorites"]["items"]

    legacy_payload = {
        "v": 1,
        "items": [
            {"label": "Areas", "path": "/settings#areas", "position": 1},
            {"label": "Legacy", "path": "https://intdata.pro/admin", "position": 2},
        ],
    }
    res = client.put(
        "/api/v1/user/settings/favorites",
        json={"value": legacy_payload},
    )
    assert res.status_code == 200
    sanitized = res.json()["value"]
    assert sanitized["items"] == [
        {"label": "Areas", "path": "/settings#areas", "position": 1}
    ]

    # repeated PUT should overwrite the value with another allowed link
    new_val2 = {
        "v": 1,
        "items": [
            {"label": "Tasks", "path": "/tasks", "position": 1},
        ],
    }
    res = client.put(
        "/api/v1/user/settings/favorites",
        json={"value": new_val2},
    )
    assert res.status_code == 200
    persisted = client.get("/api/v1/user/settings/favorites").json()["value"]
    assert persisted["items"] == [
        {"label": "Tasks", "path": "/tasks", "position": 1}
    ]


def test_no_runtime_utils_imports():
    root = Path(__file__).resolve().parents[1]
    for module in (root / "web", root / "bot"):
        for path in module.rglob("*.py"):
            text = path.read_text()
            assert "import utils" not in text
            assert "from utils" not in text
