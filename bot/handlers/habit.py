"""Handlers for managing user habits via Telegram bot."""

from __future__ import annotations

from datetime import date

from aiogram import Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message

from core.services.nexus_service import HabitService
from core.utils.habit_utils import calc_progress


router = Router()


class HabitAddStates(StatesGroup):
    """States for creating a habit step by step."""

    waiting_for_name = State()
    waiting_for_frequency = State()


class HabitDoneStates(StatesGroup):
    """State for receiving habit id when marking as done."""

    waiting_for_id = State()


@router.message(Command("habit_list"))
async def cmd_habit_list(message: Message) -> None:
    """Send list of user's habits with progress percentage."""

    async with HabitService() as service:
        habits = await service.list_habits(owner_id=message.from_user.id)
    if not habits:
        await message.answer("У тебя пока нет привычек.")
        return
    lines = []
    for habit in habits:
        percent = calc_progress(habit.progress)
        lines.append(f"{habit.id}: {habit.name} — {percent}%")
    await message.answer("\n".join(lines))


@router.message(Command("habit_add"))
async def cmd_habit_add(message: Message, state: FSMContext) -> None:
    """Create a new habit or start dialog if args missing."""

    parts = message.text.split()[1:]
    if len(parts) >= 2:
        name, frequency = parts[0], parts[1].lower()
        await _create_habit(message, name, frequency)
    elif len(parts) == 1:
        await state.update_data(name=parts[0])
        await message.answer("Укажи частоту (daily/weekly/monthly):")
        await state.set_state(HabitAddStates.waiting_for_frequency)
    else:
        await message.answer("Введи название привычки:")
        await state.set_state(HabitAddStates.waiting_for_name)


@router.message(HabitAddStates.waiting_for_name)
async def habit_add_get_name(message: Message, state: FSMContext) -> None:
    name = message.text.strip()
    await state.update_data(name=name)
    await message.answer("Укажи частоту (daily/weekly/monthly):")
    await state.set_state(HabitAddStates.waiting_for_frequency)


@router.message(HabitAddStates.waiting_for_frequency)
async def habit_add_get_frequency(message: Message, state: FSMContext) -> None:
    frequency = message.text.strip().lower()
    data = await state.get_data()
    name = data.get("name")
    await _create_habit(message, name, frequency)
    await state.clear()


async def _create_habit(message: Message, name: str, frequency: str) -> None:
    if frequency not in {"daily", "weekly", "monthly"}:
        await message.answer("Частота должна быть: daily, weekly или monthly.")
        return
    async with HabitService() as service:
        habit = await service.create_habit(
            message.from_user.id, name, frequency
        )
    await message.answer(
        f"Привычка '{habit.name}' создана с ID {habit.id}."
    )


@router.message(Command("habit_done"))
async def cmd_habit_done(message: Message, state: FSMContext) -> None:
    """Toggle today's progress for a habit by its ID."""

    parts = message.text.split()[1:]
    if parts and parts[0].isdigit():
        await _toggle_habit_progress(message, int(parts[0]))
    else:
        await message.answer("Укажи ID привычки:")
        await state.set_state(HabitDoneStates.waiting_for_id)


@router.message(HabitDoneStates.waiting_for_id)
async def habit_done_get_id(message: Message, state: FSMContext) -> None:
    if not message.text.isdigit():
        await message.answer("ID должно быть числом.")
        return
    await _toggle_habit_progress(message, int(message.text))
    await state.clear()


async def _toggle_habit_progress(message: Message, habit_id: int) -> None:
    async with HabitService() as service:
        habit = await service.get(habit_id)
        if habit is None or habit.owner_id != message.from_user.id:
            await message.answer("Привычка не найдена.")
            return
        updated = await service.toggle_progress(habit_id, date.today())
    percent = calc_progress(updated.progress)
    await message.answer(f"Прогресс '{updated.name}': {percent}%")
