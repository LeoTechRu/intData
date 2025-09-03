import types

import pytest

import bot.handlers.telegram as tg_handlers


class DummyMessage:
    def __init__(self):
        self.from_user = types.SimpleNamespace(id=1, first_name="Test")
        self.answers: list[str] = []
        self.text = ""

    async def answer(self, text: str) -> None:
        self.answers.append(text)


@pytest.mark.asyncio
async def test_help_lists_key_commands():
    message = DummyMessage()
    await tg_handlers.cmd_help(message)
    joined = "\n".join(message.answers)
    assert "/note" in joined
    assert "/time_start" in joined
