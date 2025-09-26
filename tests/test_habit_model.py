import pytest
from backend.models import Habit


def test_habit_relationships_present():
    assert hasattr(Habit, "area")
    assert hasattr(Habit, "project")
