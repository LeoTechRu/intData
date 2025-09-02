import sqlalchemy as sa
from sqlalchemy import create_engine

from core.db import repair


def test_backfill_habits_area_from_project():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE areas (id INTEGER PRIMARY KEY, owner_id INTEGER, title TEXT)"))
        conn.execute(sa.text("CREATE TABLE projects (id INTEGER PRIMARY KEY, owner_id INTEGER, area_id INTEGER)"))
        conn.execute(sa.text("CREATE TABLE habits (id INTEGER PRIMARY KEY, owner_id INTEGER, project_id INTEGER, area_id INTEGER)"))
        conn.execute(sa.text("INSERT INTO areas (id, owner_id, title) VALUES (1,1,'A')"))
        conn.execute(sa.text("INSERT INTO projects (id, owner_id, area_id) VALUES (1,1,1)"))
        conn.execute(sa.text("INSERT INTO habits (id, owner_id, project_id, area_id) VALUES (1,1,1,NULL)"))
        updated = repair.backfill_habits_area(conn)
        assert updated == 1
        area_id = conn.execute(sa.text("SELECT area_id FROM habits WHERE id=1")).scalar()
        assert area_id == 1


def test_backfill_habits_antifarm_defaults():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE habits (id INTEGER PRIMARY KEY, val DOUBLE PRECISION, daily_limit INTEGER, cooldown_sec INTEGER)"
            )
        )
        conn.execute(
            sa.text(
                "CREATE TABLE habit_logs (id INTEGER PRIMARY KEY, habit_id INTEGER, val_after FLOAT, owner_id INTEGER, at TIMESTAMP, delta INTEGER)"
            )
        )
        conn.execute(
            sa.text(
                "INSERT INTO habits (id, val, daily_limit, cooldown_sec) VALUES (1, 0, NULL, NULL)"
            )
        )
        conn.execute(
            sa.text(
                "INSERT INTO habit_logs (id, habit_id, val_after, owner_id, at, delta) VALUES (1,1,NULL,1,'2025-01-01',1)"
            )
        )
        stats = repair.backfill_habits_antifarm(conn)
        assert stats["limits"] == 1
        assert stats["cooldowns"] == 1
        dl, cd = conn.execute(sa.text("SELECT daily_limit, cooldown_sec FROM habits WHERE id=1")).one()
        assert dl == 10 and cd == 60
        val_after = conn.execute(sa.text("SELECT val_after FROM habit_logs WHERE id=1")).scalar()
        assert val_after == 0
