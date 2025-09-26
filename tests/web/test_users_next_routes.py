from __future__ import annotations

import re

from fastapi.testclient import TestClient

from backend.models import WebUser

import web as web_app
from web.routes.index import _load_next_html


class DummyWebUserService:
    def __init__(self, user: WebUser) -> None:
        self.user = user

    async def __aenter__(self) -> "DummyWebUserService":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def get_by_id(self, user_id: int) -> WebUser:
        return self.user


def make_client(monkeypatch) -> TestClient:
    dummy = WebUser(id=1, username="tester", full_name="Test User", role="single")
    monkeypatch.setattr(web_app, "WebUserService", lambda: DummyWebUserService(dummy))
    client = TestClient(web_app.app)
    client.cookies.set("web_user_id", "1")
    return client


def _get_next_asset_path() -> str:
    _load_next_html.cache_clear()
    html = _load_next_html("users")
    match = re.search(r'src=\"(/_next/static/[^\"?]+)"', html)
    if not match:
        raise AssertionError("users.html must include at least one Next static asset")
    return match.group(1)


def test_users_page_served(monkeypatch):
    client = make_client(monkeypatch)
    response = client.get("/users")
    assert response.status_code == 200
    assert "data-app-shell" in response.text


def test_next_static_served(monkeypatch):
    asset_path = _get_next_asset_path()
    client = make_client(monkeypatch)
    response = client.get(asset_path)
    assert response.status_code == 200
    assert response.content
