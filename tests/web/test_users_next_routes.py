from pathlib import Path

from fastapi.testclient import TestClient

from core.models import WebUser

import web as web_app
from web.routes.index import _load_next_html

NEXT_ROOT = Path(__file__).resolve().parents[1] / "web" / ".next"
NEXT_HTML = NEXT_ROOT / "server" / "app" / "users.html"
NEXT_STATIC_FILE = NEXT_ROOT / "static" / "test.txt"


def ensure_next_assets() -> None:
    NEXT_HTML.parent.mkdir(parents=True, exist_ok=True)
    NEXT_STATIC_FILE.parent.mkdir(parents=True, exist_ok=True)
    NEXT_HTML.write_text(
        "<!DOCTYPE html><html><body><div data-app-shell>test-users</div></body></html>",
        encoding="utf-8",
    )
    NEXT_STATIC_FILE.write_text("ok", encoding="utf-8")
    _load_next_html.cache_clear()


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


def test_users_page_served(monkeypatch):
    ensure_next_assets()
    client = make_client(monkeypatch)
    response = client.get("/users")
    assert response.status_code == 200
    assert "data-app-shell" in response.text or "test-users" in response.text


def test_next_static_served(monkeypatch):
    ensure_next_assets()
    client = make_client(monkeypatch)
    response = client.get("/_next/static/test.txt")
    assert response.status_code == 200
    assert response.text == "ok"
