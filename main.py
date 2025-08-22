# /sd/tg/LeonidBot/main.py
from db import bot, dp
from handlers.telegram import user_router, group_router, router
from logger import LoggerMiddleware
import asyncio


async def main():
    # Регистрация мидлвари
    dp.message.middleware(LoggerMiddleware(bot))
    dp.callback_query.middleware(LoggerMiddleware(bot))
    dp.include_router(user_router)
    dp.include_router(group_router)
    dp.include_router(router)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())