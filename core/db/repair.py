from __future__ import annotations

import json
import logging
import uuid

import sqlalchemy as sa
from sqlalchemy import insert
from sqlalchemy.engine import Connection

logger = logging.getLogger(__name__)

# System default area for quick capture.
# Created at startup if missing and cannot be administrated or deleted.
DEFAULT_AREA_TITLE = "Входящие"


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


def ensure_user_settings_table(conn: Connection) -> bool:
    """Create ``user_settings`` table if missing.

    Returns ``True`` if the table was created.
    """
    if _table_exists(conn, "user_settings"):
        return False

    dialect = conn.dialect.name
    if dialect == "sqlite":
        conn.execute(
            sa.text(
                """
                CREATE TABLE IF NOT EXISTS user_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id BIGINT NOT NULL,
                    key VARCHAR(64) NOT NULL,
                    value JSON NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (user_id, key)
                )
                """
            )
        )
    else:
        conn.execute(
            sa.text(
                """
                CREATE TABLE IF NOT EXISTS user_settings (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL REFERENCES users_web(id) ON DELETE CASCADE,
                    key VARCHAR(64) NOT NULL,
                    value JSONB NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    UNIQUE (user_id, key)
                )
                """
            )
        )
        conn.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id)"
            )
        )

    logger.info("ensure_user_settings_table: created")
    return True


def _get_default_area(conn: Connection, owner_id: uuid.UUID | int | None):
    if owner_id is None or not _table_exists(conn, "areas"):
        return None
    row = conn.execute(
        sa.text(
            "SELECT id FROM areas WHERE owner_id=:o AND title=:t LIMIT 1"
        ),
        {"o": owner_id, "t": DEFAULT_AREA_TITLE},
    ).fetchone()
    return row[0] if row else None


def ensure_default_areas(conn: Connection) -> int:
    """Ensure each owner has a default 'Входящие' area."""
    owners: set[uuid.UUID | int] = set()
    tables = ["areas", "projects", "calendar_items", "resources", "tasks", "time_entries"]
    for table in tables:
        if not _table_exists(conn, table):
            continue
        try:
            rows = conn.execute(
                sa.text(f"SELECT DISTINCT owner_id FROM {table}")
            ).fetchall()
            owners.update(r[0] for r in rows if r[0] is not None)
        except Exception:
            continue
    created = 0
    for owner_id in owners:
        if _get_default_area(conn, owner_id) is None:
            conn.execute(
                sa.text(
                    "INSERT INTO areas (id, owner_id, title) VALUES (:i, :o, :t)"
                ),
                {
                    "i": str(uuid.uuid4()),
                    "o": owner_id,
                    "t": DEFAULT_AREA_TITLE,
                },
            )
            created += 1
    logger.info("ensure_default_areas: created=%s", created)
    return created


def backfill_notes_area(conn: Connection) -> int:
    """Assign default area to notes missing one."""
    if not _table_exists(conn, "notes"):
        return 0
    rows = conn.execute(
        sa.text("SELECT id, owner_id FROM notes WHERE area_id IS NULL")
    ).fetchall()
    updated = 0
    for note_id, owner_id in rows:
        area_id = _get_default_area(conn, owner_id)
        if area_id is None:
            continue
        conn.execute(
            sa.text("UPDATE notes SET area_id=:a WHERE id=:n"),
            {"a": area_id, "n": note_id},
        )
        updated += 1
    logger.info("backfill_notes_area: updated=%s", updated)
    return updated


def backfill_projects_area(conn: Connection) -> int:
    """Assign default area to projects without one."""
    if not _table_exists(conn, "projects"):
        return 0
    rows = conn.execute(
        sa.text("SELECT id, owner_id FROM projects WHERE area_id IS NULL")
    ).fetchall()
    updated = 0
    for proj_id, owner_id in rows:
        area_id = _get_default_area(conn, owner_id)
        if area_id is None:
            continue
        conn.execute(
            sa.text("UPDATE projects SET area_id=:a WHERE id=:i"),
            {"a": area_id, "i": proj_id},
        )
        updated += 1
    logger.info("backfill_projects_area: updated=%s", updated)
    return updated


def backfill_habits_area(conn: Connection) -> int:
    """Assign area to habits using project inheritance or default area."""
    if not _table_exists(conn, "habits"):
        return 0
    try:
        rows = conn.execute(
            sa.text(
                "SELECT id, owner_id, project_id, area_id FROM habits"
            )
        ).fetchall()
    except Exception:
        rows = []
    updated = 0
    for hid, owner_id, project_id, area_id in rows:
        target_area = area_id
        if project_id:
            target_area = conn.execute(
                sa.text("SELECT area_id FROM projects WHERE id=:p"),
                {"p": project_id},
            ).scalar()
        elif area_id is None:
            target_area = _get_default_area(conn, owner_id)
        if target_area and target_area != area_id:
            conn.execute(
                sa.text("UPDATE habits SET area_id=:a WHERE id=:i"),
                {"a": target_area, "i": hid},
            )
            updated += 1
    try:
        conn.execute(sa.text("ALTER TABLE habits ALTER COLUMN area_id SET NOT NULL"))
    except Exception as exc:  # pragma: no cover - log and continue
        logger.warning("habits area not null failed: %s", exc)
    logger.info("backfill_habits_area: updated=%s", updated)
    return updated


def backfill_tasks_resources(conn: Connection) -> dict[str, int]:
    """Ensure tasks/resources inherit area from project or default area."""
    updated_ci = 0
    updated_res = 0

    if _table_exists(conn, "calendar_items"):
        try:
            rows = conn.execute(
                sa.text(
                    "SELECT id, owner_id, project_id, area_id FROM calendar_items WHERE kind='task'"
                )
            ).fetchall()
        except Exception:
            rows = []
        for cid, owner_id, project_id, area_id in rows:
            target_area = None
            if project_id:
                target_area = conn.execute(
                    sa.text("SELECT area_id FROM projects WHERE id=:p"),
                    {"p": project_id},
                ).scalar()
            elif area_id is None:
                target_area = _get_default_area(conn, owner_id)
            if target_area and target_area != area_id:
                conn.execute(
                    sa.text("UPDATE calendar_items SET area_id=:a WHERE id=:i"),
                    {"a": target_area, "i": cid},
                )
                updated_ci += 1

    if _table_exists(conn, "resources"):
        try:
            rows = conn.execute(
                sa.text("SELECT id, owner_id, project_id, area_id FROM resources")
            ).fetchall()
        except Exception:
            rows = []
        for rid, owner_id, project_id, area_id in rows:
            target_area = None
            if project_id:
                target_area = conn.execute(
                    sa.text("SELECT area_id FROM projects WHERE id=:p"),
                    {"p": project_id},
                ).scalar()
            elif area_id is None:
                target_area = _get_default_area(conn, owner_id)
            if target_area and target_area != area_id:
                conn.execute(
                    sa.text("UPDATE resources SET area_id=:a WHERE id=:i"),
                    {"a": target_area, "i": rid},
                )
                updated_res += 1

    logger.info(
        "backfill_tasks_resources: calendar_items=%s resources=%s", updated_ci, updated_res
    )
    return {"calendar_items": updated_ci, "resources": updated_res}


def backfill_time_entries(conn: Connection) -> dict[str, int]:
    """Denormalize project/area ids on time entries and create quick tasks."""
    if not _table_exists(conn, "time_entries"):
        return {"updated": 0, "created_tasks": 0}
    try:
        rows = conn.execute(
            sa.text("SELECT id, user_id, task_id FROM time_entries")
        ).fetchall()
    except Exception:
        rows = []

    updated = 0
    created = 0
    for entry_id, user_id, task_id in rows:
        if task_id:
            proj_area = conn.execute(
                sa.text(
                    "SELECT project_id, area_id FROM tasks WHERE id=:t"
                ),
                {"t": task_id},
            ).fetchone()
            if proj_area:
                project_id, area_id = proj_area
                conn.execute(
                    sa.text(
                        "UPDATE time_entries SET project_id=:p, area_id=:a WHERE id=:i"
                    ),
                    {"p": project_id, "a": area_id, "i": entry_id},
                )
                updated += 1
        else:
            area_id = _get_default_area(conn, user_id)
            new_task_id = str(uuid.uuid4())
            try:
                conn.execute(
                    sa.text(
                        "INSERT INTO calendar_items (id, owner_id, kind, area_id) "
                        "VALUES (:i, :o, 'task', :a)"
                    ),
                    {"i": new_task_id, "o": user_id, "a": area_id},
                )
            except Exception:
                pass
            try:
                conn.execute(
                    sa.text(
                        "INSERT INTO tasks (id, status, created_at, updated_at) "
                        "VALUES (:i, 'open', now(), now())"
                    ),
                    {"i": new_task_id},
                )
            except Exception:
                pass
            conn.execute(
                sa.text(
                    "UPDATE time_entries SET task_id=:t, project_id=NULL, area_id=:a WHERE id=:i"
                ),
                {"t": new_task_id, "a": area_id, "i": entry_id},
            )
            created += 1

    logger.info(
        "backfill_time_entries: updated=%s created_tasks=%s", updated, created
    )
    return {"updated": updated, "created_tasks": created}


def _migrate_favorites(conn: Connection) -> None:
    """Backfill favorites from legacy ``users_favorites`` table."""
    if not _table_exists(conn, "users_favorites"):
        return
    if not _table_exists(conn, "user_settings"):
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


def run_repair(conn: Connection) -> dict[str, object]:
    """Perform backfill and repair tasks.

    Each step commits independently so that a failure does not abort the
    entire sequence.
    """

    stats: dict[str, object] = {}

    def _step(name: str, fn) -> None:
        nonlocal stats
        try:
            res = fn(conn)
            conn.commit()
            if isinstance(res, dict):
                stats.update({f"{name}_{k}": v for k, v in res.items()})
            else:
                stats[name] = res
        except Exception as exc:  # pragma: no cover - log and continue
            conn.rollback()
            logger.warning("repair step %s failed: %s", name, exc)

    _step("user_settings_created", ensure_user_settings_table)
    _step("default_areas", ensure_default_areas)
    _step("notes_area", backfill_notes_area)
    _step("projects_area", backfill_projects_area)
    _step("habits_area", backfill_habits_area)
    _step("tasks_resources", backfill_tasks_resources)
    _step("time_entries", backfill_time_entries)
    _step("migrate_favorites", _migrate_favorites)

    logger.info("repair summary: %s", json.dumps(stats, ensure_ascii=False))
    return stats
