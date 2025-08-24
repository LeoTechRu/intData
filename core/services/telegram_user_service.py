from __future__ import annotations

from typing import Optional, Any
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import TgUser


class TelegramUserService:
    """CRUD helpers for :class:`TgUser`."""

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "TelegramUserService":
        if self.session is None:
            self.session = db.async_session()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if not self._external:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
            await self.session.close()

    # CRUD operations
    async def get_by_id(self, user_id: int) -> Optional[TgUser]:
        result = await self.session.execute(select(TgUser).where(TgUser.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_telegram_id(self, telegram_id: int) -> Optional[TgUser]:
        result = await self.session.execute(select(TgUser).where(TgUser.telegram_id == telegram_id))
        return result.scalar_one_or_none()

    async def create(self, **data: Any) -> TgUser:
        user = TgUser(**data)
        self.session.add(user)
        await self.session.flush()
        return user

    async def update_from_telegram(self, telegram_id: int, **data: Any) -> TgUser:
        """Create or update a telegram user from Telegram login data."""

        user = await self.get_by_telegram_id(telegram_id)
        if not user:
            user = TgUser(telegram_id=telegram_id)
            self.session.add(user)
        for field in ["username", "first_name", "last_name", "language_code"]:
            if field in data and data[field] is not None:
                setattr(user, field, data[field])
        user.updated_at = datetime.utcnow()
        await self.session.flush()
        return user
