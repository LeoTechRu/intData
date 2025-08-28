import pytest
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.testclient import TestClient
from pathlib import Path
from datetime import timedelta

from core.utils import utcnow

from core.models import (
    WebUser,
    TgUser,
    UserRole,
    Task,
    TaskStatus,
    Reminder,
    CalendarEvent,
    TimeEntry,
)
from web.routes import index
from web.dependencies import get_current_web_user


class FakeTaskService:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def list_tasks(self, owner_id=None):
        now = utcnow()
        return [
            Task(id=1, owner_id=owner_id, title="Task A", status=TaskStatus.done, due_date=now + timedelta(days=1)),
            Task(id=2, owner_id=owner_id, title="Task B", status=TaskStatus.todo, due_date=now + timedelta(hours=1)),
        ]


class FakeReminderService:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def list_reminders(self, owner_id=None):
        now = utcnow()
        return [
            Reminder(id=1, owner_id=owner_id, message="Drink water", remind_at=now + timedelta(minutes=30))
        ]


class FakeCalendarService:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def list_events(self, owner_id=None):
        now = utcnow()
        return [
            CalendarEvent(id=1, owner_id=owner_id, title="Team meeting", start_at=now + timedelta(hours=2))
        ]


class FakeTimeService:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def list_entries(self, owner_id=None):
        now = utcnow()
        return [
            TimeEntry(id=1, owner_id=owner_id, start_time=now - timedelta(hours=2), end_time=now - timedelta(hours=1))
        ]


class FakeTgService:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def list_user_groups(self, telegram_id):
        return []


class FakeProjectService:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def list(self, owner_id):
        return []


@pytest.fixture
def client(monkeypatch):
    app = FastAPI()
    static_dir = Path(__file__).resolve().parents[2] / "web" / "static"
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    app.include_router(index.router)

    user = WebUser(id=1, username="alice", role=UserRole.single.name)
    user.telegram_accounts = [TgUser(id=1, telegram_id=1, role=UserRole.single.name)]

    def override_user():
        return user

    app.dependency_overrides[get_current_web_user] = override_user

    monkeypatch.setattr(index, "TelegramUserService", FakeTgService)
    monkeypatch.setattr(index, "ProjectService", FakeProjectService)
    monkeypatch.setattr(index, "TaskService", FakeTaskService)
    monkeypatch.setattr(index, "ReminderService", FakeReminderService)
    monkeypatch.setattr(index, "CalendarService", FakeCalendarService)
    monkeypatch.setattr(index, "TimeService", FakeTimeService)

    return TestClient(app)


def test_dashboard_displays_real_data(client):
    res = client.get("/")
    assert res.status_code == 200
    assert "Task A" in res.text
    assert "Drink water" in res.text
    assert "Team meeting" in res.text
    assert "Выполнено целей" in res.text
