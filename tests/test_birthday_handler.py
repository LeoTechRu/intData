import types
from datetime import datetime, timedelta

import pytest

import bot.handlers.telegram as tg_handlers


class DummyService:
    def __init__(self, user):
        self.user = user

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def get_user_by_telegram_id(self, telegram_id):
        return self.user


class DummyState:
    def __init__(self):
        self.state = None

    async def set_state(self, state):
        self.state = state

    async def clear(self):
        self.state = None

    async def get_state(self):
        return self.state


class DummyMessage:
    def __init__(self, user_id, first_name):
        self.from_user = types.SimpleNamespace(id=user_id, first_name=first_name)
        self.text = ""
        self.answers: list[str] = []

    async def answer(self, text):
        self.answers.append(text)


@pytest.mark.asyncio
async def test_cmd_birthday_reads_from_bot_settings(monkeypatch):
    today_str = datetime.today().strftime("%d.%m.%Y")
    user = types.SimpleNamespace(bot_settings={"birthday": today_str})
    dummy_service = DummyService(user)
    monkeypatch.setattr(
        tg_handlers,
        "TelegramUserService",
        lambda: dummy_service,
    )
    message = DummyMessage(1, "Test")
    state = DummyState()
    await tg_handlers.cmd_birthday(message, state)
    assert any(
        "сегодня ваш день рождения" in text for text in message.answers
    )


@pytest.mark.asyncio
async def test_cmd_birthday_prompts_only_when_missing(monkeypatch):
    user = types.SimpleNamespace(bot_settings={})
    monkeypatch.setattr(
        tg_handlers,
        "TelegramUserService",
        lambda: DummyService(user),
    )
    message = DummyMessage(1, "Test")
    state = DummyState()
    await tg_handlers.cmd_birthday(message, state)
    assert any(
        "введите ваш день рождения" in text.lower() for text in message.answers
    )
    assert await state.get_state() == tg_handlers.UpdateDataStates.waiting_for_birthday

    message.answers.clear()
    await state.clear()
    tomorrow = (datetime.today().date() + timedelta(days=1)).strftime("%d.%m.%Y")
    user.bot_settings["birthday"] = tomorrow
    await tg_handlers.cmd_birthday(message, state)
    assert any(
        "до дня рождения осталось" in text for text in message.answers
    )
    assert await state.get_state() is None
