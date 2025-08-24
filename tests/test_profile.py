from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from core.models import User, UserRole
from web.routes import profile


class FakeService:
    users = {
        1: User(telegram_id=1, first_name="Alice", username="alice", role=UserRole.single.value),
        2: User(telegram_id=2, first_name="Bob", username="bob", role=UserRole.moderator.value),
    }

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def get_user_and_groups(self, telegram_id: int):
        return self.users.get(telegram_id), []

    async def get_contact_info(self, telegram_id: int):
        user = self.users.get(telegram_id)
        if not user:
            return {}
        return {
            "user": user,
            "groups": [],
            "telegram_id": user.telegram_id,
            "username": f"@{user.username}" if user.username else None,
            "full_display_name": user.full_display_name,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "display_name": user.full_display_name or user.first_name,
            "email": user.email,
            "phone": user.phone,
            "birthday": user.birthday.strftime("%d.%m.%Y") if user.birthday else None,
            "language_code": user.language_code,
            "role_name": UserRole(user.role).name,
        }

    async def update_user_profile(self, telegram_id: int, data):
        user = self.users.get(telegram_id)
        if user:
            for k, v in data.items():
                setattr(user, k, v)
        return user

    async def get_user_by_telegram_id(self, telegram_id: int):
        return self.users.get(telegram_id)


app = FastAPI()
static_dir = Path(__file__).resolve().parent.parent / "web" / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
# Patch UserService in profile module
profile.UserService = FakeService
app.include_router(profile.router)
client = TestClient(app)


def auth_header(user_id: int):
    return {"Authorization": f"Bearer {user_id}"}


def test_user_can_view_own_profile():
    res = client.get("/profile/1", headers=auth_header(1))
    assert res.status_code == 200
    assert "Alice" in res.text
    assert res.text.count("<header") == 1


def test_single_user_cannot_view_others():
    res = client.get("/profile/2", headers=auth_header(1))
    assert res.status_code == 403


def test_higher_role_cannot_view_others():
    res = client.get("/profile/1", headers=auth_header(2))
    assert res.status_code == 403


def test_single_user_can_update_self():
    res = client.post(
        "/profile/1",
        headers=auth_header(1),
        data={"username": "alice_new", "birthday": "31.12.2000"},
        follow_redirects=True,
    )
    assert res.status_code == 200
    assert "alice_new" in res.text
    assert "31.12.2000" in res.text


def test_profile_accepts_iso_date_format():
    res = client.post(
        "/profile/1",
        headers=auth_header(1),
        data={"birthday": "2001-01-02"},
        follow_redirects=True,
    )
    assert res.status_code == 200
    assert "02.01.2001" in res.text


def test_single_user_cannot_update_others():
    res = client.post("/profile/2", headers=auth_header(1), data={"username": "bad"})
    assert res.status_code == 403
