from __future__ import annotations

from datetime import datetime, timezone

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message

from backend.services.task_service import TaskService
from backend.services.task_notification_service import TaskNotificationService
from backend.services.telegram_user_service import TelegramUserService
from backend.models import (
    Task,
    TaskStatus,
    TaskControlStatus,
    TaskRefuseReason,
    TaskWatcherLeftReason,
)
from backend.utils import utcnow

router = Router()


class TaskAddStates(StatesGroup):
    waiting_for_title = State()


class TaskRenameStates(StatesGroup):
    waiting_for_task_id = State()
    waiting_for_title = State()


class TaskDueStates(StatesGroup):
    waiting_for_task_id = State()
    waiting_for_due = State()


class TaskRemindStates(StatesGroup):
    waiting_for_task_id = State()
    waiting_for_reminder = State()


class TaskControlStates(StatesGroup):
    waiting_for_task_id = State()
    waiting_for_frequency = State()


class TaskForgetStates(StatesGroup):
    waiting_for_task_id = State()
    waiting_for_reason = State()


@router.message(Command("task_add"))
async def cmd_task_add(message: Message, state: FSMContext) -> None:
    await state.set_state(TaskAddStates.waiting_for_title)
    await message.answer("Введи название задачи. Отправь /cancel чтобы выйти.")


@router.message(TaskAddStates.waiting_for_title, F.text)
async def process_task_add_title(message: Message, state: FSMContext) -> None:
    title = (message.text or "").strip()
    if not title:
        await message.answer("Название не может быть пустым. Попробуй ещё раз.")
        return
    async with TaskService() as service:
        inbox = await service.ensure_default_area(message.from_user.id)
        task = await service.create_task(
            owner_id=message.from_user.id,
            title=title,
            area_id=inbox.id,
        )
    await message.answer(f"Готово! Задача #{task.id} создана в «{inbox.title}».")
    await state.clear()


@router.message(Command("task_rename"))
async def cmd_task_rename(message: Message, state: FSMContext) -> None:
    await state.set_state(TaskRenameStates.waiting_for_task_id)
    await message.answer("Укажи ID задачи, которую нужно переименовать.")


@router.message(TaskRenameStates.waiting_for_task_id, F.text)
async def process_task_rename_id(message: Message, state: FSMContext) -> None:
    raw = (message.text or "").strip()
    if not raw.isdigit():
        await message.answer("ID должен быть числом. Введи ID ещё раз.")
        return
    await state.update_data(task_id=int(raw))
    await state.set_state(TaskRenameStates.waiting_for_title)
    await message.answer("Напиши новое название задачи.")


@router.message(TaskRenameStates.waiting_for_title, F.text)
async def process_task_rename_title(message: Message, state: FSMContext) -> None:
    title = (message.text or "").strip()
    if not title:
        await message.answer("Название не может быть пустым. Попробуй ещё раз.")
        return
    data = await state.get_data()
    task_id = data.get("task_id")
    async with TaskService() as service:
        task = await service.session.get(Task, task_id)
        if task is None or task.owner_id != message.from_user.id:
            await message.answer("Задача не найдена или принадлежит другому пользователю.")
        else:
            await service.update_task(task_id, title=title)
            await message.answer(f"Название задачи #{task_id} обновлено.")
    await state.clear()


@router.message(Command("task_due"))
async def cmd_task_due(message: Message, state: FSMContext) -> None:
    await state.set_state(TaskDueStates.waiting_for_task_id)
    await message.answer(
        "Укажи ID задачи для установки дедлайна."
    )


@router.message(TaskDueStates.waiting_for_task_id, F.text)
async def process_task_due_id(message: Message, state: FSMContext) -> None:
    raw = (message.text or "").strip()
    if not raw.isdigit():
        await message.answer("ID должен быть числом. Попробуй ещё раз.")
        return
    await state.update_data(task_id=int(raw))
    await state.set_state(TaskDueStates.waiting_for_due)
    await message.answer(
        "Введи дедлайн в формате YYYY-MM-DD HH:MM. Для UTC добавь +00:00, иначе время будет воспринято как UTC."
    )


def _parse_datetime(text: str) -> datetime | None:
    text = text.strip()
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M %z"):
        try:
            dt = datetime.strptime(text, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            continue
    return None


@router.message(TaskDueStates.waiting_for_due, F.text)
async def process_task_due_value(message: Message, state: FSMContext) -> None:
    dt = _parse_datetime(message.text or "")
    if dt is None:
        await message.answer("Не удалось разобрать дату. Используй формат YYYY-MM-DD HH:MM или добавь зону, например +03:00.")
        return
    data = await state.get_data()
    task_id = data.get("task_id")
    async with TaskService() as service:
        task = await service.session.get(Task, task_id)
        if task is None or task.owner_id != message.from_user.id:
            await message.answer("Задача не найдена или принадлежит другому пользователю.")
        else:
            await service.update_task(task_id, due_date=dt)
            await message.answer(f"Дедлайн для задачи #{task_id} установлен: {dt.isoformat(timespec='minutes')} UTC")
    await state.clear()


@router.message(Command("task_remind"))
async def cmd_task_remind(message: Message, state: FSMContext) -> None:
    await state.set_state(TaskRemindStates.waiting_for_task_id)
    await message.answer("Укажи ID задачи, для которой нужно напоминание.")


@router.message(TaskRemindStates.waiting_for_task_id, F.text)
async def process_task_remind_id(message: Message, state: FSMContext) -> None:
    raw = (message.text or "").strip()
    if not raw.isdigit():
        await message.answer("ID должен быть числом. Попробуй ещё раз.")
        return
    await state.update_data(task_id=int(raw))
    await state.set_state(TaskRemindStates.waiting_for_reminder)
    await message.answer(
        "Укажи время напоминания: `YYYY-MM-DD HH:MM [+TZ] [интервал_минут]`. Интервал задаёт повторение в минутах (опционально).",
        parse_mode="MarkdownV2",
    )


@router.message(TaskRemindStates.waiting_for_reminder, F.text)
async def process_task_remind_value(message: Message, state: FSMContext) -> None:
    parts = (message.text or "").split()
    if len(parts) < 2:
        await message.answer("Нужно минимум дата и время. Пример: 2025-09-20 09:00 +03:00 60")
        return
    freq = None
    if parts[-1].isdigit():
        freq = int(parts[-1])
        parts = parts[:-1]
    dt = _parse_datetime(" ".join(parts))
    if dt is None:
        await message.answer("Не удалось разобрать дату. Проверь формат и повтори.")
        return
    data = await state.get_data()
    task_id = data.get("task_id")
    async with TaskService() as service:
        task = await service.session.get(Task, task_id)
        if task is None or task.owner_id != message.from_user.id:
            await message.answer("Задача не найдена или принадлежит другому пользователю.")
        else:
            await service.deactivate_reminders(task_id, kind="manual")
            await service.schedule_reminder(
                task_id=task_id,
                owner_id=message.from_user.id,
                kind="manual",
                trigger_at=dt,
                frequency_minutes=freq,
                payload={"source": "bot"},
            )
            freq_text = f" (повтор каждые {freq} мин)" if freq else ""
            await message.answer(
                f"Напоминание для задачи #{task_id} сохранено на {dt.isoformat(timespec='minutes')} UTC{freq_text}."
            )
    await state.clear()


@router.message(Command("task_watch"))
async def cmd_task_watch(message: Message) -> None:
    parts = (message.text or "").split()
    if len(parts) < 3:
        await message.answer("Использование: /task_watch <task_id> <@username|telegram_id>.")
        return
    task_id_raw, target = parts[1], parts[2]
    if not task_id_raw.isdigit():
        await message.answer("task_id должен быть числом.")
        return
    task_id = int(task_id_raw)
    async with TaskService() as service:
        task = await service.session.get(Task, task_id)
        if task is None or task.owner_id != message.from_user.id:
            await message.answer("Задача не найдена или принадлежит другому пользователю.")
            return
        user_service = TelegramUserService(service.session)
        watcher = None
        if target.startswith("@"):
            watcher = await user_service.get_user_by_username(target[1:])
        elif target.isdigit():
            watcher = await user_service.get_user_by_telegram_id(int(target))
        if watcher is None:
            await message.answer("Не удалось найти пользователя. Убедись, что он писал боту и указал корректный логин.")
            return
        active_watchers = await service.list_watchers(task_id)
        if any(w.watcher_id == watcher.telegram_id for w in active_watchers):
            await message.answer("Этот пользователь уже наблюдает за задачей.")
            return
        await service.add_watcher(task_id, watcher.telegram_id, added_by=message.from_user.id)
        notifier = TaskNotificationService(service.session)
        await notifier.notify_watcher_added(task, watcher.telegram_id, added_by=message.from_user.id)
    await message.answer(f"Наблюдатель {watcher.telegram_id} добавлен к задаче #{task_id}.")


@router.message(Command("task_unwatch"))
async def cmd_task_unwatch(message: Message) -> None:
    parts = (message.text or "").split()
    if len(parts) < 2:
        await message.answer("Использование: /task_unwatch <task_id>.")
        return
    task_id_raw = parts[1]
    if not task_id_raw.isdigit():
        await message.answer("task_id должен быть числом.")
        return
    task_id = int(task_id_raw)
    async with TaskService() as service:
        task = await service.session.get(Task, task_id)
        if task is None:
            await message.answer("Задача не найдена.")
            return
        left = await service.leave_watcher(
            task_id,
            message.from_user.id,
            reason=TaskWatcherLeftReason.manual,
        )
        if not left:
            await message.answer("Вы не значились наблюдателем этой задачи.")
            return
        notifier = TaskNotificationService(service.session)
        await notifier.notify_watcher_left(task, message.from_user.id)
    await message.answer(f"Наблюдение за задачей #{task_id} отключено.")


@router.message(Command("task_control"))
async def cmd_task_control(message: Message, state: FSMContext) -> None:
    await state.set_state(TaskControlStates.waiting_for_task_id)
    await message.answer("Укажи ID задачи для включения контроля.")


@router.message(TaskControlStates.waiting_for_task_id, F.text)
async def process_task_control_id(message: Message, state: FSMContext) -> None:
    raw = (message.text or "").strip()
    if not raw.isdigit():
        await message.answer("ID должен быть числом. Попробуй ещё раз.")
        return
    await state.update_data(task_id=int(raw))
    await state.set_state(TaskControlStates.waiting_for_frequency)
    await message.answer("Через сколько минут повторять контроль после дедлайна? Укажи число (минимум 30).")


@router.message(TaskControlStates.waiting_for_frequency, F.text)
async def process_task_control_frequency(message: Message, state: FSMContext) -> None:
    raw = (message.text or "").strip()
    if not raw.isdigit():
        await message.answer("Нужно указать число минут. Попробуй ещё раз.")
        return
    freq = max(30, int(raw))
    data = await state.get_data()
    task_id = data.get("task_id")
    now = utcnow()
    async with TaskService() as service:
        task = await service.session.get(Task, task_id)
        if task is None or task.owner_id != message.from_user.id:
            await message.answer("Задача не найдена или принадлежит другому пользователю.")
        else:
            next_at = task.due_date or now
            if getattr(next_at, "tzinfo", None) is None:
                next_at = next_at.replace(tzinfo=timezone.utc)
            await service.set_control_settings(
                task_id,
                enabled=True,
                frequency_minutes=freq,
                next_at=next_at,
                remind_policy={"frequency_minutes": freq, "source": "bot"},
            )
            await message.answer(
                f"Контроль для задачи #{task_id} включён. Следующее напоминание: {next_at.isoformat(timespec='minutes')}."
            )
    await state.clear()


@router.message(Command("task_forget"))
async def cmd_task_forget(message: Message, state: FSMContext) -> None:
    await state.set_state(TaskForgetStates.waiting_for_task_id)
    await message.answer("Укажи ID задачи, которую больше не нужно контролировать.")


@router.message(TaskForgetStates.waiting_for_task_id, F.text)
async def process_task_forget_id(message: Message, state: FSMContext) -> None:
    raw = (message.text or "").strip()
    if not raw.isdigit():
        await message.answer("ID должен быть числом. Попробуй ещё раз.")
        return
    await state.update_data(task_id=int(raw))
    await state.set_state(TaskForgetStates.waiting_for_reason)
    await message.answer("Выбери исход: напиши `выполнена` или `не будет выполнена`.")


@router.message(TaskForgetStates.waiting_for_reason, F.text)
async def process_task_forget_reason(message: Message, state: FSMContext) -> None:
    reason_text = (message.text or "").strip().lower()
    if reason_text not in ("выполнена", "не будет выполнена"):
        await message.answer("Нужно выбрать: `выполнена` или `не будет выполнена`.")
        return
    reason = TaskRefuseReason.done if reason_text == "выполнена" else TaskRefuseReason.wont_do
    status = TaskControlStatus.done if reason == TaskRefuseReason.done else TaskControlStatus.dropped
    data = await state.get_data()
    task_id = data.get("task_id")
    async with TaskService() as service:
        task = await service.session.get(service.session.registry.mapped_classes['Task'], task_id)  # type: ignore[attr-defined]
        if task is None or task.owner_id != message.from_user.id:
            await message.answer("Задача не найдена или принадлежит другому пользователю.")
        else:
            await service.set_control_settings(
                task_id,
                enabled=False,
                frequency_minutes=None,
                next_at=None,
                status=status,
                refused_reason=reason,
            )
            await service.deactivate_reminders(task_id)
            notifier = TaskNotificationService(service.session)
            await notifier.notify_task_status(task, status, reason=reason)
            if reason == TaskRefuseReason.done and task.status != TaskStatus.done:
                await service.update_task(task_id, status=TaskStatus.done)
            await message.answer(
                f"Контроль по задаче #{task_id} завершён ({reason_text})."
            )
    await state.clear()


def _format_stats(stats: dict[str, int]) -> str:
    return (
        f"Выполнено: {stats.get('done', 0)}\n"
        f"Актуально: {stats.get('active', 0)}\n"
        f"Отказались: {stats.get('dropped', 0)}"
    )


@router.message(Command("task_stats"))
async def cmd_task_stats(message: Message) -> None:
    async with TaskService() as service:
        stats = await service.stats_by_owner(message.from_user.id)
    await message.answer(_format_stats(stats))


@router.message(Command("task_stats_active"))
async def cmd_task_stats_active(message: Message) -> None:
    async with TaskService() as service:
        stats = await service.stats_by_owner(message.from_user.id)
    await message.answer(f"Актуальных задач: {stats.get('active', 0)}")


@router.message(Command("task_stats_dropped"))
async def cmd_task_stats_dropped(message: Message) -> None:
    async with TaskService() as service:
        stats = await service.stats_by_owner(message.from_user.id)
    await message.answer(f"Отказов от задач: {stats.get('dropped', 0)}")
