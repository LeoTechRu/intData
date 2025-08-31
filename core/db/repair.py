from __future__ import annotations

from __future__ import annotations

import json
import logging

import sqlalchemy as sa
from sqlalchemy import insert
from sqlalchemy.engine import Connection

logger = logging.getLogger(__name__)


def _table_exists(conn: Connection, name: str) -> bool:
    """Check if a table exists in the current database."""
    try:
        inspector = sa.inspect(conn)
        return inspector.has_table(name)
    except Exception:
        try:
            res = conn.execute(
                sa.text("SELECT 1 FROM sqlite_master WHERE type='table' AND name=:n"),
                {"n": name},
            ).scalar()
            return bool(res)
        except Exception:
            return False


def _migrate_favorites(conn: Connection) -> None:
    """Backfill favorites from legacy ``users_favorites`` table."""
    if not _table_exists(conn, "users_favorites"):
        return
    rows = conn.execute(
        sa.text(
            "SELECT owner_id, label, path, position "
            "FROM users_favorites ORDER BY owner_id, position"
        )
    ).fetchall()
    if not rows:
        return
    by_user: dict[int, list[dict[str, object]]] = {}
    for owner_id, label, path, position in rows:
        by_user.setdefault(owner_id, []).append(
            {"label": label, "path": path, "position": position}
        )
    user_settings = sa.table(
        "user_settings",
        sa.column("user_id", sa.BigInteger),
        sa.column("key", sa.String),
        sa.column("value", sa.JSON),
    )
    for user_id, items in by_user.items():
        value = {"v": 1, "items": items}
        stmt = insert(user_settings).values(
            user_id=user_id, key="favorites", value=value
        )
        if conn.dialect.name == "postgresql":
            stmt = stmt.on_conflict_do_nothing(index_elements=["user_id", "key"])
        try:
            conn.execute(stmt)
        except Exception as exc:  # pragma: no cover - log and continue
            logger.warning("favorites backfill failed for %s: %s", user_id, exc)


def run_repair(conn: Connection) -> None:
    """Perform backfill and repair tasks."""
    _migrate_favorites(conn)
