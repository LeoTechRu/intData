#!/usr/bin/env python3
"""Simple SQL migration runner.

Applies all .sql files from ``core/db/migrations`` in alphabetical order
and writes applied filenames to the ``schema_migrations`` table.
"""
from __future__ import annotations

import os
from pathlib import Path

import psycopg
from psycopg.rows import tuple_row
from dotenv import load_dotenv


def get_conn() -> psycopg.Connection:
    load_dotenv()
    url = os.getenv("DATABASE_URL")
    if not url:
        user = os.getenv("DB_USER", "")
        password = os.getenv("DB_PASSWORD", "")
        host = os.getenv("DB_HOST", "localhost")
        port = os.getenv("DB_PORT", "5432")
        name = os.getenv("DB_NAME", "")
        url = f"postgresql://{user}:{password}@{host}:{port}/{name}"
    return psycopg.connect(url)


def ensure_table(conn: psycopg.Connection) -> set[str]:
    with conn.cursor(row_factory=tuple_row) as cur:
        cur.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version text primary key)")
        cur.execute("SELECT version FROM schema_migrations")
        return {row[0] for row in cur.fetchall()}


def apply_migration(conn: psycopg.Connection, path: Path) -> None:
    sql = path.read_text()
    with conn.cursor() as cur:
        cur.execute(sql)
        cur.execute("INSERT INTO schema_migrations(version) VALUES (%s)", (path.name,))
    print(f"applied {path.name}")


def main() -> None:
    migrations_dir = Path(__file__).parent / "migrations"
    with get_conn() as conn:
        applied = ensure_table(conn)
        for path in sorted(migrations_dir.glob("*.sql")):
            if path.name not in applied:
                apply_migration(conn, path)
        conn.commit()


if __name__ == "__main__":
    main()
