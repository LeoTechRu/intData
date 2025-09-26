import pytest
from datetime import timedelta
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.models import Alarm, CalendarItem, CalendarEvent, Task, TaskStatus, TimeEntry, WebUser, TgUser, UserRole
from backend.utils import utcnow
from web.routes import api_router
from web.dependencies import get_current_web_user
from backend.services import dashboard_service


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


class FakeAlarmService:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def list_upcoming(self, owner_id=None, limit=None):
        now = utcnow()
        item = CalendarItem(id=1, owner_id=owner_id, title="Drink water", start_at=now)
        alarm = Alarm(id=1, item_id=1, trigger_at=now + timedelta(minutes=30))
        alarm.item = item
        return [alarm]


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
        return [
            SimpleNamespace(
                telegram_id=99,
                owner_id=telegram_id,
                title="Focus Crew",
                participants_count=42,
            )
        ]

    @property
    def session(self):
        return object()


class FakeProjectService:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def list(self, owner_id):
        return [SimpleNamespace(id=1, owner_id=owner_id, name="Project X")]


class FakeGroupModerationService:
    def __init__(self, session):  # pragma: no cover - signature compatibility
        self.session = session

    async def groups_overview(self, group_ids=None, limit=5, since_days=14):
        return [
            {
                "group": SimpleNamespace(title="Focus Crew", telegram_id=99),
                "members_total": 42,
                "active_members": 30,
                "quiet_members": 10,
                "unpaid_members": 5,
                "last_activity": utcnow(),
            }
        ]


class FakeHabitService:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def list_habits(self, owner_id=None):
        return [SimpleNamespace(id=7, name="Meditation", progress={utcnow().date().isoformat(): True})]


@pytest.fixture
def client(monkeypatch):
    app = FastAPI()
    app.include_router(api_router, prefix="/api/v1")

    user = WebUser(id=1, username="alice", role=UserRole.single.name)
    user.telegram_accounts = [TgUser(id=1, telegram_id=1, role=UserRole.single.name)]

    def override_user():
        return user

    app.dependency_overrides[get_current_web_user] = override_user

    monkeypatch.setattr(dashboard_service, "TelegramUserService", FakeTgService)
    monkeypatch.setattr(dashboard_service, "ProjectService", FakeProjectService)
    monkeypatch.setattr(dashboard_service, "GroupModerationService", FakeGroupModerationService)
    monkeypatch.setattr(dashboard_service, "TaskService", FakeTaskService)
    monkeypatch.setattr(dashboard_service, "AlarmService", FakeAlarmService)
    monkeypatch.setattr(dashboard_service, "CalendarService", FakeCalendarService)
    monkeypatch.setattr(dashboard_service, "TimeService", FakeTimeService)
    monkeypatch.setattr(dashboard_service, "HabitService", FakeHabitService)

    return TestClient(app)


def test_dashboard_displays_real_data(client):
    res = client.get("/api/v1/dashboard/overview")
    assert res.status_code == 200
    payload = res.json()

    assert payload["profile"]["username"] == "alice"
    assert payload["metrics"]["goals"]["value"] == "1"
    assert any(item["title"] == "Team meeting" for item in payload["collections"]["next_events"])
    assert any(item["title"] == "Drink water" for item in payload["collections"]["reminders"])
    assert any(item["title"] == "Task A" for item in payload["collections"]["upcoming_tasks"])
    assert any(item["name"] == "Meditation" for item in payload["habits"])
