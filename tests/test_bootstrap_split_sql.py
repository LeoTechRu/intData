from pathlib import Path

from backend.db.bootstrap import split_sql


def test_split_sql_many_statements():
    sql = Path("backend/db/ddl/001_calendar.sql").read_text()
    stmts = split_sql(sql)
    assert len(stmts) > 10
    assert all(not s.strip().endswith(";") for s in stmts)


def test_split_sql_do_block():
    sql = "DO $$ BEGIN RAISE NOTICE 'hi'; END $$;"
    stmts = split_sql(sql)
    assert len(stmts) == 1
