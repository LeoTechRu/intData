from __future__ import annotations

"""Service helpers for working with ``user_settings`` table.

Expected JSON shapes::

    favorites = {
        "v": 1,
        "items": [
            {"label": "Задачи", "path": "/tasks", "position": 1},
            {"label": "Календарь", "path": "/calendar", "position": 2},
            ...
        ]
    }

    dashboard_layout = {
        "v": 1,
        "columns": 12,
        "gutter": 12,
        "layouts": {"lg": [{"id": "profile_card", "x": 0, "y": 0, "w": 4, "h": 2}], ...},
        "hidden": []
    }
"""

from typing import Optional

import sqlalchemy as sa
from sqlalchemy import insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import UserSettings


class UserSettingsService:
    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "UserSettingsService":
        if self.session is None:
            self.session = db.async_session()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:  # pragma: no cover - same as others
        if not self._external:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
            await self.session.close()

    async def get(self, user_id: int, key: str) -> dict | None:
        res = await self.session.execute(
            sa.select(UserSettings.value).where(
                UserSettings.user_id == user_id, UserSettings.key == key
            )
        )
        value = res.scalar()
        if isinstance(value, dict):
            return value
        return None

    async def upsert(self, user_id: int, key: str, value: dict) -> dict:
        dialect = self.session.bind.dialect.name

        if dialect == "postgresql":
            stmt = (
                pg_insert(UserSettings)
                .values(user_id=user_id, key=key, value=value)
                .on_conflict_do_update(
                    index_elements=[UserSettings.user_id, UserSettings.key],
                    set_={"value": value, "updated_at": sa.func.now()},
                )
                .returning(UserSettings.value)
            )
            res = await self.session.execute(stmt)
            return res.scalar()

        if dialect == "sqlite":
            stmt = (
                sqlite_insert(UserSettings)
                .values(user_id=user_id, key=key, value=value)
                .on_conflict_do_update(
                    index_elements=[UserSettings.user_id, UserSettings.key],
                    set_={"value": value, "updated_at": sa.func.now()},
                )
            )
            await self.session.execute(stmt)
            return value

        # fallback: insert only for other dialects
        stmt = insert(UserSettings).values(user_id=user_id, key=key, value=value)
        await self.session.execute(stmt)
        return value
