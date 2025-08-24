from datetime import datetime
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.testclient import TestClient

from core.models import WebUser
from web.routes import profile
from web.dependencies import get_current_web_user


class FakeService:
    user = WebUser(id=1, username="alice", full_name="Alice", role="single")

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def get_user_by_identifier(self, identifier):
        if identifier in ("alice", 1):
            return self.user
        return None

    async def update_profile(self, user_id, data):
        birthday = data.get("birthday")
        if birthday:
            for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
                try:
                    FakeService.user.birthday = datetime.strptime(birthday, fmt).date()
                    break
                except ValueError:
                    continue
        return self.user


@pytest.fixture(autouse=True)
def _patch_service(monkeypatch):
    monkeypatch.setattr(profile, "WebUserService", FakeService)


app = FastAPI()
static_dir = Path(__file__).resolve().parent.parent / "web" / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
app.include_router(profile.router)
client = TestClient(app)


def override_current():
    return FakeService().user


app.dependency_overrides[get_current_web_user] = override_current


def test_profile_redirect():
    res = client.get("/profile", allow_redirects=False)
    assert res.status_code == 302
    assert res.headers["location"] == "/profile/alice"


def test_profile_view_and_edit():
    res = client.get("/profile/alice")
    assert res.status_code == 200
    assert res.text.count("<header") == 1

    res = client.post("/profile/alice", data={"birthday": "2001-01-02"}, follow_redirects=True)
    assert "02.01.2001" in res.text
    res = client.post("/profile/alice", data={"birthday": "31.12.2000"}, follow_redirects=True)
    assert "31.12.2000" in res.text
