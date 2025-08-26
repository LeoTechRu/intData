from __future__ import annotations

from datetime import date, timedelta
from typing import List, Tuple

from ..models import Habit


def _get_status(habit: Habit, day: date) -> str:
    today = date.today()
    key = day.isoformat()
    progress = habit.progress or {}
    if day > today:
        return "future"
    if day == today:
        return "completed" if progress.get(key) else "current"
    return "completed" if progress.get(key) else "missed"


def generate_calendar(habit: Habit, start_date: date | None = None) -> List[Tuple[date, str]]:
    """Return list of 30 days with status for each day."""
    today = date.today()
    base = habit.created_at.date() if habit.created_at else today
    start = start_date or max(base, today - timedelta(days=14))
    days = [start + timedelta(days=i) for i in range(30)]
    return [(day, _get_status(habit, day)) for day in days]


def get_grid_headers(frequency: str) -> List[date]:
    today = date.today()
    if frequency == "weekly":
        start = today - timedelta(days=today.weekday())
        return [start - timedelta(weeks=i) for i in range(4, -1, -1)]
    if frequency == "monthly":
        headers: List[date] = []
        year = today.year
        month = today.month
        for _ in range(4):
            headers.append(date(year, month, 1))
            month -= 1
            if month == 0:
                month = 12
                year -= 1
        return list(reversed(headers))
    return [today - timedelta(days=i) for i in range(7, -1, -1)]
