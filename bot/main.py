# /sd/intdata/bot/main.py
import asyncio
import logging

from aiogram.exceptions import TelegramNetworkError
from backend.db import bot, dp
from backend.db.init_app import init_app_once
from backend.db.engine import ENGINE_MODE
from backend.env import env
from bot.handlers.telegram import user_router, group_router, router
from bot.handlers.note import router as note_router
from bot.handlers.task import router as task_router
from bot.handlers.habit import router as habit_router
from backend.logger import LoggerMiddleware
from backend.models import LogLevel
from backend.services.telegram_user_service import TelegramUserService
from bot.middleware import GroupActivityMiddleware


async def main() -> None:
    """Run bot polling with middleware and routers."""
    logging.getLogger(__name__).info("Bot startup: ENGINE_MODE=%s", ENGINE_MODE)
    await init_app_once(env)

    dp.message.middleware(LoggerMiddleware(bot))
    dp.message.middleware(GroupActivityMiddleware())
    dp.callback_query.middleware(LoggerMiddleware(bot))
    dp.include_router(user_router)
    dp.include_router(group_router)
    dp.include_router(habit_router)
    dp.include_router(router)
    dp.include_router(note_router)
    dp.include_router(task_router)

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
