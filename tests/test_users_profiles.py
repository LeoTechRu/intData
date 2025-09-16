from __future__ import annotations

from types import SimpleNamespace
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.testclient import TestClient

from core.models import WebUser
from web.routes import users
from web.dependencies import get_current_web_user


class FakeProfileAccess:
    def __init__(self, slug: str, *, owner: bool = True) -> None:
        self.profile = SimpleNamespace(
            slug=slug,
            display_name="Alice Example",
            headline="Senior Producer",
            summary="Веду программы обучения",
            avatar_url=None,
            cover_url=None,
            profile_meta={"links": []},
            tags=["education", "onboarding"],
            grants=[],
        )
        self.sections = [{"id": "overview", "title": "Обзор"}]
        self.matched_grants = []
        self.is_owner = owner
        self.is_admin = False


class FakeProfileService:
    def __init__(self) -> None:
        self._catalog = [FakeProfileAccess("alice")]

    async def __aenter__(self) -> "FakeProfileService":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:  # pragma: no cover
        pass

    async def list_catalog(self, **_kwargs):
        return self._catalog

    async def get_profile(self, **_kwargs):
        return FakeProfileAccess("alice")


class FakeUserService:
    def __init__(self) -> None:
        self.updated_payload = None
        self.session = SimpleNamespace(execute=self._execute)

    async def __aenter__(self) -> "FakeUserService":
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def _execute(self, _stmt):
        user = WebUser(id=1, username="alice", full_name="Alice", role="single")
        user.telegram_accounts = []
        return SimpleNamespace(scalar_one_or_none=lambda: user)

    async def get_by_id(self, user_id):
        return WebUser(id=user_id, username="alice", full_name="Alice", role="single")

    async def update_profile(self, user_id, data):
        self.updated_payload = (user_id, data)
        return WebUser(id=user_id, username="alice", full_name="Alice", role="single")


@pytest.fixture(autouse=True)
def _patch_services(monkeypatch):
    monkeypatch.setattr(users, "ProfileService", FakeProfileService)
    fake_user_service = FakeUserService()
    monkeypatch.setattr(users, "WebUserService", lambda: fake_user_service)
    return fake_user_service


app = FastAPI()
static_dir = Path(__file__).resolve().parent.parent / "web" / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
app.include_router(users.router)
client = TestClient(app)


def override_current():
    return WebUser(id=1, username="alice", full_name="Alice", role="single")


app.dependency_overrides[get_current_web_user] = override_current


def test_users_catalog():
    res = client.get("/users")
    assert res.status_code == 200
    assert "Команда" in res.text
    assert "Alice Example" in res.text


def test_user_profile_view():
    res = client.get("/users/alice")
    assert res.status_code == 200
    assert "Alice Example" in res.text
    assert "Веду программы" in res.text


def test_user_profile_update(monkeypatch):
    tracker = FakeUserService()
    monkeypatch.setattr(users, "WebUserService", lambda: tracker)
    res = client.post(
        "/users/alice",
        data={"full_name": "Alice Example", "headline": "Lead"},
        follow_redirects=False,
    )
    assert res.status_code == 303
    assert tracker.updated_payload[0] == 1
    assert tracker.updated_payload[1]["full_name"] == "Alice Example"
    assert tracker.updated_payload[1]["headline"] == "Lead"
