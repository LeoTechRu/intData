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
