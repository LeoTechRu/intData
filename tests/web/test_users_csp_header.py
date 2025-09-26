from __future__ import annotations

from fastapi.testclient import TestClient

from backend.models import WebUser

import web as web_app
from web.routes.index import _load_next_html
from web.security.csp import extract_inline_script_hashes


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


def _load_expected_hashes() -> tuple[str, ...]:
    _load_next_html.cache_clear()
    html = _load_next_html("users")
    hashes = extract_inline_script_hashes(html)
    if not hashes:
        raise AssertionError("users.html should contain inline scripts from Next.js build")
    return hashes


def test_users_page_adds_inline_script_hashes(monkeypatch):
    expected_hashes = _load_expected_hashes()
    client = make_client(monkeypatch)
    response = client.get("/users")
    assert response.status_code == 200
    header = response.headers["content-security-policy"]
    for token in expected_hashes:
        assert f"'sha256-{token}'" in header


def test_users_page_extends_custom_csp(monkeypatch):
    expected_hashes = _load_expected_hashes()
    monkeypatch.setenv("CSP_DEFAULT", "default-src 'self'; script-src 'self'")
    monkeypatch.setenv("SECURITY_HEADERS_ENABLED", "1")
    client = make_client(monkeypatch)
    response = client.get("/users")
    header = response.headers["content-security-policy"]
    assert "script-src 'self'" in header
    for token in expected_hashes:
        assert f"'sha256-{token}'" in header
