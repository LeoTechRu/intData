from __future__ import annotations

import json
import logging
import uuid

import sqlalchemy as sa
from sqlalchemy import insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
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
    for table_name in tables:
        if not _table_exists(conn, table_name):
            continue
        try:
            owner_column = sa.column("owner_id")
            pseudo_table = sa.table(table_name, owner_column)
            stmt = sa.select(sa.distinct(pseudo_table.c.owner_id))
            rows = conn.execute(stmt).fetchall()
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
            logger.warning("habit %s missing area and project", hid)
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


def backfill_dailies_area(conn: Connection) -> int:
    """Assign area to dailies using project inheritance or default area."""
    if not _table_exists(conn, "dailies"):
        return 0
    try:
        rows = conn.execute(
            sa.text("SELECT id, owner_id, project_id, area_id FROM dailies")
        ).fetchall()
    except Exception:
        rows = []
    updated = 0
    for did, owner_id, project_id, area_id in rows:
        target_area = area_id
        if project_id:
            target_area = conn.execute(
                sa.text("SELECT area_id FROM projects WHERE id=:p"),
                {"p": project_id},
            ).scalar()
        elif area_id is None:
            logger.warning("daily %s missing area and project", did)
            target_area = _get_default_area(conn, owner_id)
        if target_area and target_area != area_id:
            conn.execute(
                sa.text("UPDATE dailies SET area_id=:a WHERE id=:i"),
                {"a": target_area, "i": did},
            )
            updated += 1
    try:
        conn.execute(sa.text("ALTER TABLE dailies ALTER COLUMN area_id SET NOT NULL"))
    except Exception as exc:  # pragma: no cover
        logger.warning("dailies area not null failed: %s", exc)
    logger.info("backfill_dailies_area: updated=%s", updated)
    return updated


def backfill_rewards_area(conn: Connection) -> int:
    """Assign area to rewards using project inheritance or default area."""
    if not _table_exists(conn, "rewards"):
        return 0
    try:
        rows = conn.execute(
            sa.text("SELECT id, owner_id, project_id, area_id FROM rewards")
        ).fetchall()
    except Exception:
        rows = []
    updated = 0
    for rid, owner_id, project_id, area_id in rows:
        target_area = area_id
        if project_id:
            target_area = conn.execute(
                sa.text("SELECT area_id FROM projects WHERE id=:p"),
                {"p": project_id},
            ).scalar()
        elif area_id is None:
            logger.warning("reward %s missing area and project", rid)
            target_area = _get_default_area(conn, owner_id)
        if target_area and target_area != area_id:
            conn.execute(
                sa.text("UPDATE rewards SET area_id=:a WHERE id=:i"),
                {"a": target_area, "i": rid},
            )
            updated += 1
    try:
        conn.execute(sa.text("ALTER TABLE rewards ALTER COLUMN area_id SET NOT NULL"))
    except Exception as exc:  # pragma: no cover
        logger.warning("rewards area not null failed: %s", exc)
    logger.info("backfill_rewards_area: updated=%s", updated)
    return updated


def backfill_habits_antifarm(conn: Connection) -> dict[str, int]:
    """Fill new anti-farm columns with sensible defaults and audit logs."""
    updated_limit = 0
    updated_cd = 0
    updated_val = 0
    if _table_exists(conn, "habits"):
        try:
            res = conn.execute(
                sa.text(
                    "UPDATE habits SET daily_limit=:dl WHERE daily_limit IS NULL"
                ),
                {"dl": 10},
            )
            updated_limit = res.rowcount or 0
        except Exception:
            pass
        try:
            res = conn.execute(
                sa.text(
                    "UPDATE habits SET cooldown_sec=:cd WHERE cooldown_sec IS NULL"
                ),
                {"cd": 60},
            )
            updated_cd = res.rowcount or 0
        except Exception:
            pass

    if _table_exists(conn, "habit_logs") and _table_exists(conn, "habits"):
        try:
            rows = conn.execute(
                sa.text(
                    """
                    SELECT hl.id, h.val FROM habit_logs hl
                    JOIN habits h ON hl.habit_id = h.id
                    WHERE hl.val_after IS NULL
                    """
                )
            ).fetchall()
            for log_id, val in rows:
                conn.execute(
                    sa.text(
                        "UPDATE habit_logs SET val_after=:v WHERE id=:i"
                    ),
                    {"v": val, "i": log_id},
                )
            updated_val = len(rows)
        except Exception:
            pass

    return {
        "limits": updated_limit,
        "cooldowns": updated_cd,
        "val_after": updated_val,
    }


def backfill_user_stats(conn: Connection) -> int:
    """Ensure every user has a corresponding user_stats row."""
    if not _table_exists(conn, "users_web"):
        return 0
    if not _table_exists(conn, "user_stats"):
        try:
            conn.execute(
                sa.text(
                    """
                    CREATE TABLE IF NOT EXISTS user_stats (
                        owner_id BIGINT PRIMARY KEY,
                        level INTEGER DEFAULT 1,
                        xp INTEGER DEFAULT 0,
                        gold INTEGER DEFAULT 0,
                        hp INTEGER DEFAULT 50,
                        kp BIGINT DEFAULT 0,
                        last_cron DATE
                    )
                    """
                )
            )
        except Exception:
            return 0
    dialect = conn.dialect.name
    rows = conn.execute(sa.text("SELECT id FROM users_web")).fetchall()
    created = 0
    for (uid,) in rows:
        if dialect == "postgresql":
            stmt = sa.text(
                "INSERT INTO user_stats (owner_id) VALUES (:o) ON CONFLICT (owner_id) DO NOTHING"
            )
        else:
            stmt = sa.text(
                "INSERT OR IGNORE INTO user_stats (owner_id) VALUES (:o)"
            )
        res = conn.execute(stmt, {"o": uid})
        if res.rowcount:
            created += 1
    logger.info("backfill_user_stats: created=%s", created)
    return created
def backfill_profile_visibility(conn: Connection) -> dict[str, int]:
    """Ensure user profiles have coherent visibility grants and metadata."""

    if not _table_exists(conn, "entity_profiles") or not _table_exists(conn, "users_web"):
        return {"grants_added": 0, "privacy_updated": 0}

    result = conn.execute(
        sa.text(
            """
            SELECT p.id, p.entity_id, p.profile_meta, u.privacy_settings
            FROM entity_profiles AS p
            JOIN users_web AS u ON p.entity_type = 'user' AND u.id = p.entity_id
            """
        )
    ).fetchall()

    grants_added = 0
    grants_removed = 0
    privacy_updates = 0
    meta_updates = 0

    for profile_id, user_id, raw_meta, raw_privacy in result:
        grants_rows = conn.execute(
            sa.text(
                "SELECT audience_type FROM entity_profile_grants WHERE profile_id = :pid"
            ),
            {"pid": profile_id},
        ).fetchall()
        grant_set = {row[0] for row in grants_rows}

        if isinstance(raw_meta, dict):
            meta = dict(raw_meta)
        elif isinstance(raw_meta, str) and raw_meta:
            try:
                meta = json.loads(raw_meta)
            except json.JSONDecodeError:
                meta = {}
        else:
            meta = {}

        if isinstance(raw_privacy, dict):
            privacy = dict(raw_privacy)
        elif isinstance(raw_privacy, str) and raw_privacy:
            try:
                privacy = json.loads(raw_privacy)
            except json.JSONDecodeError:
                privacy = {}
        else:
            privacy = {}

        existing_visibility = str(privacy.get("profile_visibility") or "").lower()
        if existing_visibility == "private":
            desired_visibility = "private"
        elif existing_visibility in {"authenticated", "public"}:
            desired_visibility = existing_visibility
        elif "public" in grant_set:
            desired_visibility = "public"
        elif "authenticated" in grant_set:
            desired_visibility = "authenticated"
        else:
            desired_visibility = "private"

        if desired_visibility == "public":
            if "public" not in grant_set:
                conn.execute(
                    sa.text(
                        "INSERT INTO entity_profile_grants (profile_id, audience_type) VALUES (:pid, 'public') ON CONFLICT DO NOTHING"
                    ),
                    {"pid": profile_id},
                )
                grants_added += 1
            if "authenticated" not in grant_set:
                conn.execute(
                    sa.text(
                        "INSERT INTO entity_profile_grants (profile_id, audience_type) VALUES (:pid, 'authenticated') ON CONFLICT DO NOTHING"
                    ),
                    {"pid": profile_id},
                )
                grants_added += 1
        elif desired_visibility == "authenticated" and "authenticated" not in grant_set:
            conn.execute(
                sa.text(
                    "INSERT INTO entity_profile_grants (profile_id, audience_type) VALUES (:pid, 'authenticated') ON CONFLICT DO NOTHING"
                ),
                {"pid": profile_id},
            )
            grants_added += 1
        if desired_visibility != "public" and "public" in grant_set:
            conn.execute(
                sa.text("DELETE FROM entity_profile_grants WHERE profile_id=:pid AND audience_type='public'"),
                {"pid": profile_id},
            )
            grants_removed += 1
            grant_set.discard("public")
        if desired_visibility not in {"public", "authenticated"} and "authenticated" in grant_set:
            conn.execute(
                sa.text("DELETE FROM entity_profile_grants WHERE profile_id=:pid AND audience_type='authenticated'"),
                {"pid": profile_id},
            )
            grants_removed += 1
            grant_set.discard("authenticated")
        if desired_visibility and privacy.get("profile_visibility") != desired_visibility:
            privacy["profile_visibility"] = desired_visibility
            conn.execute(
                sa.text("UPDATE users_web SET privacy_settings=:val WHERE id=:uid"),
                {"val": json.dumps(privacy), "uid": user_id},
            )
            privacy_updates += 1

        if desired_visibility:
            updated = False
            if meta.get("visibility") != desired_visibility:
                meta["visibility"] = desired_visibility
                updated = True
            if meta.get("profile_visibility") != desired_visibility:
                meta["profile_visibility"] = desired_visibility
                updated = True
            if updated:
                conn.execute(
                    sa.text("UPDATE entity_profiles SET profile_meta=:val WHERE id=:pid"),
                    {"val": json.dumps(meta), "pid": profile_id},
                )
                meta_updates += 1

    return {
        "grants_added": grants_added,
        "grants_removed": grants_removed,
        "privacy_updated": privacy_updates,
        "meta_updated": meta_updates,
    }




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
        if conn.dialect.name == "postgresql":
            stmt = pg_insert(user_settings).values(
                user_id=user_id, key="favorites", value=value
            ).on_conflict_do_nothing(index_elements=["user_id", "key"])
        else:
            stmt = insert(user_settings).values(
                user_id=user_id, key="favorites", value=value
            )
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
    _step("dailies_area", backfill_dailies_area)
    _step("rewards_area", backfill_rewards_area)
    _step("habits_antifarm", backfill_habits_antifarm)
    _step("user_stats", backfill_user_stats)
    _step("profile_visibility", backfill_profile_visibility)
    _step("tasks_resources", backfill_tasks_resources)
    _step("time_entries", backfill_time_entries)
    _step("migrate_favorites", _migrate_favorites)

    logger.info("repair summary: %s", json.dumps(stats, ensure_ascii=False))
    return stats
