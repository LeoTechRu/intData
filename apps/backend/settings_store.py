from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict
from sqlalchemy import Table, Column, String, Text, Boolean, DateTime, MetaData, select, insert
from backend.db import engine as async_engine
import os


metadata = MetaData()
app_settings = Table(
    "app_settings",
    metadata,
    Column("key", String(100), primary_key=True),
    Column("value", Text, nullable=True),
    Column("is_secret", Boolean, nullable=False, default=False),
    Column("updated_at", DateTime, nullable=False, default=datetime.utcnow),
)


def _fernet():  # lazy import to avoid hard dependency when unused
    try:
        from cryptography.fernet import Fernet  # type: ignore
    except Exception:  # pragma: no cover
        return None
    key = os.getenv("PROJECT_SECRET_KEY")
    if not key:
        return None
    try:
        return Fernet(key)
    except Exception:  # pragma: no cover
        return None


class SettingsStore:
    _cache: Dict[str, Optional[str]]

    def __init__(self):
        self._cache = {}
        self._enc = _fernet()

    async def _create_if_not_exists(self):
        async with async_engine.begin() as conn:
            await conn.run_sync(metadata.create_all)

    def reload(self):
        self._cache.clear()

    def _decrypt(self, v: Optional[str], is_secret: bool) -> Optional[str]:
        if not v or not is_secret or not self._enc:
            return v
        try:
            return self._enc.decrypt(v.encode()).decode()
        except Exception:  # pragma: no cover
            return None

    def _encrypt(self, v: str) -> str:
        if not self._enc:
            return v
        return self._enc.encrypt(v.encode()).decode()

    async def get_async(self, key: str) -> Optional[str]:
        if key in self._cache:
            return self._cache[key]
        await self._create_if_not_exists()
        async with async_engine.begin() as conn:
            row = (await conn.execute(select(app_settings.c.value, app_settings.c.is_secret)
                                      .where(app_settings.c.key == key))).first()
            if not row:
                return None
            val = self._decrypt(row.value, row.is_secret)
            self._cache[key] = val
            return val

    def get(self, key: str) -> Optional[str]:
        return self._cache.get(key)

    def get_secret(self, key: str) -> Optional[str]:
        return self.get(key)

    async def set_async(self, key: str, value: Optional[str], is_secret: bool = False):
        await self._create_if_not_exists()
        enc_value = self._encrypt(value) if (is_secret and value) else value
        async with async_engine.begin() as conn:
            q = insert(app_settings).values(
                key=key,
                value=enc_value,
                is_secret=is_secret,
                updated_at=datetime.utcnow(),
            )
            q = q.on_conflict_do_update(
                index_elements=[app_settings.c.key],
                set_=dict(value=enc_value, is_secret=is_secret, updated_at=datetime.utcnow()),
            )
            await conn.execute(q)
        self._cache.pop(key, None)

