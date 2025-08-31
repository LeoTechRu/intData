import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import bot.main as bot_main
from core.models import LogLevel


def test_bot_reports_restart(monkeypatch):
    class FakeService:
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc, tb):
            pass
        async def send_log_to_telegram(self, level, message):
            self.called = (level, message)
            return True

    fake_service = FakeService()
    monkeypatch.setattr(bot_main, "TelegramUserService", lambda: fake_service)

    async def fake_init_app_once(env):
        return None

    monkeypatch.setattr(bot_main, "init_app_once", fake_init_app_once)

    fake_dp = SimpleNamespace(
        message=SimpleNamespace(middleware=lambda *a, **k: None),
        callback_query=SimpleNamespace(middleware=lambda *a, **k: None),
        include_router=lambda *a, **k: None,
        start_polling=AsyncMock(),
    )
    monkeypatch.setattr(bot_main, "dp", fake_dp)
    monkeypatch.setattr(bot_main, "bot", object())
    monkeypatch.setattr(bot_main, "LoggerMiddleware", lambda *a, **k: None)

    asyncio.run(bot_main.main())

    assert getattr(fake_service, "called", None) == (LogLevel.INFO, "Bot restarted")
    fake_dp.start_polling.assert_awaited()

