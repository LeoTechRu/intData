from __future__ import annotations

from datetime import datetime
from typing import Dict, Optional
from uuid import UUID

from sqlalchemy import insert, select

from core.db import async_session
from core.settings_store import app_settings
from core.logger import logger


async def get_settings_by_prefix(prefix: str) -> Dict[str, str]:
    """Fetch settings with keys starting with the prefix."""
    async with async_session() as session:  # type: ignore
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
    now = datetime.utcnow()
    async with async_session() as session:  # type: ignore
        async with session.begin():
            for key, value in items.items():
                stmt = (
                    insert(app_settings)
                    .values(
                        key=key,
                        value=value,
                        is_secret=False,
                        updated_at=now,
                    )
                    .on_conflict_do_update(
                        index_elements=[app_settings.c.key],
                        set_={
                            "value": value,
                            "is_secret": False,
                            "updated_at": now,
                        },
                    )
                )
                await session.execute(stmt)
    logger.info("app_settings updated", extra={"updated_by": updated_by})
