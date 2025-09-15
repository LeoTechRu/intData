"""Middleware to capture Telegram group activity and ensure CRM data stays fresh."""

from __future__ import annotations

from typing import Any, Dict, Callable

from aiogram import BaseMiddleware
from aiogram.types import Message, Update

from core.logger import logger
from core.models import GroupType
from core.services.telegram_user_service import TelegramUserService
from core.services.group_crm_service import GroupCRMService
from core.utils import utcnow


class GroupActivityMiddleware(BaseMiddleware):
    """Persist group membership and record message counters on every event."""

    async def __call__(
        self,
        handler: Callable[[Update, Dict[str, Any]], Any],
        event: Update,
        data: Dict[str, Any],
    ) -> Any:
        if isinstance(event, Message) and event.chat.type in {"group", "supergroup"}:
            await self._process_group_message(event)
        return await handler(event, data)

    async def _process_group_message(self, message: Message) -> None:
        if not message.from_user:
            return
        try:
            async with TelegramUserService() as tsvc:
                user, _ = await tsvc.get_or_create_user(
                    message.from_user.id,
                    username=message.from_user.username,
                    first_name=message.from_user.first_name,
                    last_name=message.from_user.last_name,
                    language_code=message.from_user.language_code,
                )
                group_type = GroupType(message.chat.type)
                await tsvc.get_or_create_group(
                    message.chat.id,
                    title=message.chat.title,
                    type=group_type,
                    owner_id=message.from_user.id,
                )
                await tsvc.add_user_to_group(user.telegram_id, message.chat.id)

                crm = GroupCRMService(tsvc.session)
                await crm.record_activity(
                    group_id=message.chat.id,
                    user_id=user.telegram_id,
                    messages=1,
                    occurred_at=message.date or utcnow(),
                )
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Failed to record group activity: %s", exc)


__all__ = ["GroupActivityMiddleware"]
