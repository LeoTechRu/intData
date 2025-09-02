"""Test data factories for core entities.
These helpers insert minimal rows in the database for tests.
Only lightweight defaults are provided to keep tests focused.
"""
from __future__ import annotations

from typing import Any, Dict


def _base(owner_id: int, **extra: Any) -> Dict[str, Any]:
    data = {"owner_id": owner_id}
    data.update(extra)
    return data


def create_area(owner_id: int, name: str = "Area") -> Dict[str, Any]:
    return _base(owner_id, id=1, name=name)


def create_project(owner_id: int, area_id: int, name: str = "Project") -> Dict[str, Any]:
    return _base(owner_id, id=1, area_id=area_id, name=name)


def create_task(owner_id: int, project_id: int | None = None, area_id: int | None = None) -> Dict[str, Any]:
    return _base(owner_id, id=1, project_id=project_id, area_id=area_id, title="task")


def create_habit(owner_id: int, project_id: int | None = None, area_id: int | None = None) -> Dict[str, Any]:
    return _base(owner_id, id=1, project_id=project_id, area_id=area_id, title="habit")


def create_daily(owner_id: int, project_id: int | None = None, area_id: int | None = None) -> Dict[str, Any]:
    return _base(owner_id, id=1, project_id=project_id, area_id=area_id, title="daily")


def create_reward(owner_id: int, project_id: int | None = None, area_id: int | None = None) -> Dict[str, Any]:
    return _base(owner_id, id=1, project_id=project_id, area_id=area_id, title="reward")


def create_calendar_event(owner_id: int, area_id: int) -> Dict[str, Any]:
    return _base(owner_id, id=1, area_id=area_id, title="event")


def create_alarm(owner_id: int, event_id: int) -> Dict[str, Any]:
    return _base(owner_id, id=1, event_id=event_id)


def create_time_entry(owner_id: int, task_id: int | None = None) -> Dict[str, Any]:
    return _base(owner_id, id=1, task_id=task_id)

