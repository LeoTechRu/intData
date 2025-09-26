from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.testclient import TestClient

from backend.models import WebUser
from web.routes import api_profiles
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
            entity_id=1,
        )
        self.sections = [{"id": "overview", "title": "Обзор"}]
        self.matched_grants = []
        self.is_owner = owner
        self.is_admin = False


class FakeProfileService:
    def __init__(self) -> None:
        self.catalog = [FakeProfileAccess("alice")]
        self.updated_payload = None

    async def list_catalog(self, **_kwargs):
        return self.catalog

    async def get_profile(self, **_kwargs):
        return FakeProfileAccess("alice")

    async def update_profile_data(self, **_kwargs):
        self.updated_payload = _kwargs
        return SimpleNamespace(slug="alice")

    async def ensure_default_sections(self, *_args, **_kwargs):
        return None


class _ServiceCtx:
    def __init__(self, instance: FakeProfileService) -> None:
        self.instance = instance

    async def __aenter__(self) -> FakeProfileService:
        return self.instance

    async def __aexit__(self, exc_type, exc, tb) -> None:  # pragma: no cover
        return None


@pytest.fixture(autouse=True)
def _patch_profile_service(monkeypatch):
    fake_service = FakeProfileService()
    monkeypatch.setattr(
        api_profiles,
        "ProfileService",
        lambda *args, **kwargs: _ServiceCtx(fake_service),
    )
    return fake_service


app = FastAPI()
static_dir = Path(__file__).resolve().parents[1] / "web" / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
app.include_router(api_profiles.router, prefix="/api/v1")
client = TestClient(app)


def override_current() -> WebUser:
    return WebUser(id=1, username="alice", full_name="Alice", role="single")


app.dependency_overrides[get_current_web_user] = override_current


def test_profiles_catalog_returns_items():
    res = client.get("/api/v1/profiles/users")
    assert res.status_code == 200
    payload = res.json()
    assert isinstance(payload, list)
    assert payload[0]["slug"] == "alice"
    assert payload[0]["display_name"] == "Alice Example"


def test_profile_detail_returns_data():
    res = client.get("/api/v1/profiles/users/alice")
    assert res.status_code == 200
    data = res.json()
    assert data["slug"] == "alice"
    assert data["display_name"] == "Alice Example"
    assert data["headline"] == "Senior Producer"


def test_profile_update_calls_service(monkeypatch):
    tracker = FakeProfileService()
    monkeypatch.setattr(
        api_profiles,
        "ProfileService",
        lambda *args, **kwargs: _ServiceCtx(tracker),
    )
    res = client.put(
        "/api/v1/profiles/users/alice",
        json={"headline": "Lead", "summary": "Program lead"},
    )
    assert res.status_code == 200
    assert tracker.updated_payload is not None
    assert tracker.updated_payload["data"]["headline"] == "Lead"


def test_current_profile_summary_endpoint():
    res = client.get("/api/v1/profiles/users/@me")
    assert res.status_code == 200
    data = res.json()
    assert data["user_id"] == 1
    assert data["username"] == "alice"
    assert data["profile_slug"] == "alice"
    assert data["role"] == "single"
