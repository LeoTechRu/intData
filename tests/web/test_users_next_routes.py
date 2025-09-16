from pathlib import Path

from fastapi.testclient import TestClient

from web import app

NEXT_ROOT = Path(__file__).resolve().parents[1] / "web" / ".next"
NEXT_HTML = NEXT_ROOT / "server" / "app" / "users.html"
NEXT_STATIC_FILE = NEXT_ROOT / "static" / "test.txt"


def ensure_next_assets() -> None:
    NEXT_HTML.parent.mkdir(parents=True, exist_ok=True)
    NEXT_STATIC_FILE.parent.mkdir(parents=True, exist_ok=True)
    NEXT_HTML.write_text(
        "<!DOCTYPE html><html><body><div id='__next'>test-users</div></body></html>",
        encoding="utf-8",
    )
    NEXT_STATIC_FILE.write_text("ok", encoding="utf-8")


def test_users_page_served():
    ensure_next_assets()
    client = TestClient(app)
    response = client.get("/users")
    assert response.status_code == 200
    assert "test-users" in response.text


def test_next_static_served():
    ensure_next_assets()
    client = TestClient(app)
    response = client.get("/_next/static/test.txt")
    assert response.status_code == 200
    assert response.text == "ok"

