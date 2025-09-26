from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from aiogram.types import CallbackQuery, Chat, Message, Update

from backend.logger import LoggerMiddleware, LogLevel, escape_markdown_v2


def test_escape_markdown_v2():
    text = '_*[]()~`>#+-=|{}.!'
    escaped = escape_markdown_v2(text)
    expected = ''.join('\\' + c for c in text)
    assert escaped == expected


def test_extract_chat_id():
    bot = MagicMock()
    middleware = LoggerMiddleware(bot)
    chat = Chat.model_construct(id=42, type='private')
    message = Message.model_construct(chat=chat)
    callback = CallbackQuery.model_construct(message=message)
    wrapper = SimpleNamespace(message=message)

    assert middleware._extract_chat_id(message) == 42
    assert middleware._extract_chat_id(callback) == 42
    assert middleware._extract_chat_id(wrapper) == 42
    assert middleware._extract_chat_id(object()) is None


@pytest.mark.asyncio
async def test_log_event_calls_log():
    bot = MagicMock()
    middleware = LoggerMiddleware(bot)
    middleware._log = AsyncMock()

    chat = Chat.model_construct(id=1, type='private')
    message = Message.model_construct(chat=chat, text='hi')
    await middleware._log_event(message)
    middleware._log.assert_awaited_with(LogLevel.DEBUG, '[EVENT:Message] Текст: hi', event=message)

    middleware._log.reset_mock()
    callback = CallbackQuery.model_construct(message=message, data='btn')
    await middleware._log_event(callback)
    middleware._log.assert_awaited_with(LogLevel.DEBUG, '[EVENT:Callback] Данные: btn', event=callback)

    middleware._log.reset_mock()
    unknown = Update.model_construct()
    await middleware._log_event(unknown)
    middleware._log.assert_awaited()
    level, msg = middleware._log.call_args[0][:2]
    assert level is LogLevel.DEBUG
    assert '[EVENT:Unknown]' in msg and 'Update' in msg
