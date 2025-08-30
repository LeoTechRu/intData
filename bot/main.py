# /sd/intdata/bot/main.py
import asyncio
import logging

from aiogram.exceptions import TelegramNetworkError

from core.db import bot, dp
from bot.handlers.telegram import user_router, group_router, router
from bot.handlers.note import router as note_router
from bot.handlers.habit import router as habit_router
from core.logger import LoggerMiddleware
from core.models import LogLevel
from core.services.telegram_user_service import TelegramUserService


async def main() -> None:
    """Run bot polling with middleware and routers."""
    dp.message.middleware(LoggerMiddleware(bot))
    dp.callback_query.middleware(LoggerMiddleware(bot))
    dp.include_router(user_router)
    dp.include_router(group_router)
    dp.include_router(habit_router)
    dp.include_router(router)
    dp.include_router(note_router)

    try:
        async with TelegramUserService() as user_service:
            await user_service.send_log_to_telegram(
                LogLevel.INFO, "Bot restarted"
            )
    except Exception as e:
        logging.error(f"Failed to send restart notification: {e}")

    try:
        await dp.start_polling(bot)
    except TelegramNetworkError as e:
        logging.error(f"Telegram network error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
