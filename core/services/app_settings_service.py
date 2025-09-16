from __future__ import annotations

from datetime import datetime
from typing import Dict, Optional
from uuid import UUID

from sqlalchemy import delete, insert, select, update

from core import db
from core.settings_store import app_settings, metadata
from core.logger import logger


async def _ensure_table() -> None:
    """Create the ``app_settings`` table if it does not exist."""
    async with db.engine.begin() as conn:  # type: ignore[attr-defined]
        await conn.run_sync(metadata.create_all)


async def get_settings_by_prefix(prefix: str) -> Dict[str, str]:
    """Fetch settings with keys starting with the prefix."""
    await _ensure_table()
    async with db.async_session() as session:  # type: ignore
        result = await session.execute(
            select(app_settings.c.key, app_settings.c.value).where(
                app_settings.c.key.like(f"{prefix}%")
            )
        )
        return {row.key: row.value for row in result.fetchall()}


async def upsert_settings(
    items: Dict[str, str], updated_by: Optional[UUID] = None
) -> None:
    """Insert or update settings items, marking them as non-secret."""
    if not items:
        return
    await _ensure_table()
    now = datetime.utcnow()
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            for key, value in items.items():
                exists = await session.execute(
                    select(app_settings.c.key).where(app_settings.c.key == key)
                )
                if exists.scalar():
                    stmt = (
                        update(app_settings)
                        .where(app_settings.c.key == key)
                        .values(
                            value=value,
                            is_secret=False,
                            updated_at=now,
                        )
                    )
                else:
                    stmt = insert(app_settings).values(
                        key=key,
                        value=value,
                        is_secret=False,
                        updated_at=now,
                    )
                await session.execute(stmt)
    logger.info("app_settings updated", extra={"updated_by": updated_by})


async def delete_settings_by_prefix(prefix: str) -> None:
    """Remove settings whose keys start with the given prefix."""
    await _ensure_table()
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            await session.execute(
                delete(app_settings).where(app_settings.c.key.like(f"{prefix}%"))
            )
    logger.info("app_settings cleared", extra={"prefix": prefix})
