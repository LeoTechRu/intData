from __future__ import annotations

from datetime import datetime

from backend.utils import utcnow

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy import select

from backend.models import TimeEntry
from backend.services.time_service import TimeService


router = Router()


def _fmt_dt(dt: datetime | None) -> str:
    if not dt:
        return "—"
    try:
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return dt.isoformat(sep=" ", timespec="seconds")


@router.message(Command("time_start"))
async def cmd_time_start(message: Message) -> None:
    """Start a new timer for current user with optional description."""

    desc = None
    parts = message.text.split(maxsplit=1)
    if len(parts) == 2:
        desc = parts[1].strip() or None

    async with TimeService() as service:
        # Check if there is already a running timer
        stmt = (
            select(TimeEntry)
            .where(TimeEntry.owner_id == message.from_user.id)
            .where(TimeEntry.end_time.is_(None))
            .order_by(TimeEntry.start_time.desc())
        )
        result = await service.session.execute(stmt)
        running = result.scalars().first()
        if running:
            await message.answer(
                (
                    f"У тебя уже запущен таймер #{running.id} "
                    f"(с {_fmt_dt(running.start_time)}).\n"
                    f"Останови его командой /time_stop или /time_stop {running.id}."
                )
            )
            return

        entry = await service.start_timer(owner_id=message.from_user.id, description=desc)
        await message.answer(
            f"Таймер запущен. ID: {entry.id}\n"
            f"Начало: {_fmt_dt(entry.start_time)}\n"
            f"Задача: #{entry.task_id}\n"
            f"Описание: {entry.description or '—'}"
        )


@router.message(Command("time_stop"))
async def cmd_time_stop(message: Message) -> None:
    """Stop a running timer for current user. Optionally takes an entry ID."""

    arg = message.text.split(maxsplit=1)[1:] if message.text else []
    entry_id = None
    if arg:
        entry_id = arg[0].strip()
        if not entry_id.isdigit():
            await message.answer("ID должен быть числом. Пример: /time_stop 12")
            return
        entry_id = int(entry_id)

    async with TimeService() as service:
        if entry_id is None:
            # find latest running
            stmt = (
                select(TimeEntry)
                .where(TimeEntry.owner_id == message.from_user.id)
                .where(TimeEntry.end_time.is_(None))
                .order_by(TimeEntry.start_time.desc())
            )
            result = await service.session.execute(stmt)
            running = result.scalars().first()
            if not running:
                await message.answer("Сейчас нет запущенных таймеров.")
                return
            entry_id = running.id
        # Verify ownership before stopping
        entry = await service.session.get(TimeEntry, entry_id)
        if not entry or entry.owner_id != message.from_user.id:
            await message.answer("Таймер не найден или не принадлежит тебе.")
            return
        stopped = await service.stop_timer(entry_id)
        await message.answer(
            f"Таймер #{stopped.id} остановлен.\n"
            f"Начало: {_fmt_dt(stopped.start_time)}\n"
            f"Конец: {_fmt_dt(stopped.end_time)}"
        )


@router.message(Command("time_list"))
async def cmd_time_list(message: Message) -> None:
    """Show last 10 time entries for user with durations."""

    async with TimeService() as service:
        entries = await service.list_entries(owner_id=message.from_user.id)
    # Sort newest first and take last 10
    entries = sorted(entries, key=lambda e: e.start_time or datetime.min, reverse=True)[:10]
    if not entries:
        await message.answer("Записей пока нет.")
        return
    lines = ["Последние записи времени:"]
    now = utcnow()
    for e in entries:
        end = e.end_time or now
        delta = end - (e.start_time or end)
        mins = int(delta.total_seconds() // 60)
        status = "идёт" if e.end_time is None else "завершён"
        taskinfo = f" (задача #{e.task_id})" if getattr(e, 'task_id', None) else ""
        lines.append(
            f"#{e.id}{taskinfo} [{status}] {_fmt_dt(e.start_time)} — {_fmt_dt(e.end_time)}"
            f" • {mins} мин • {e.description or '—'}"
        )
    await message.answer("\n".join(lines))


@router.message(Command("time_resume"))
async def cmd_time_resume(message: Message) -> None:
    """Resume a timer for an existing task: `/time_resume <task_id>`."""
    arg = message.text.split(maxsplit=1)[1:] if message.text else []
    if not arg:
        await message.answer("Нужно указать ID задачи. Пример: /time_resume 42")
        return
    try:
        task_id = int(arg[0])
    except ValueError:
        await message.answer("ID должен быть числом. Пример: /time_resume 42")
        return

    async with TimeService() as service:
        # Check another timer isn't running
        from sqlalchemy import select
        stmt = (
            select(TimeEntry)
            .where(TimeEntry.owner_id == message.from_user.id)
            .where(TimeEntry.end_time.is_(None))
            .order_by(TimeEntry.start_time.desc())
        )
        res = await service.session.execute(stmt)
        running = res.scalars().first()
        if running:
            await message.answer(
                f"Сначала останови текущий таймер #{running.id} (команда /time_stop)."
            )
            return
        try:
            entry = await service.resume_task(owner_id=message.from_user.id, task_id=task_id)
        except PermissionError:
            await message.answer("Задача принадлежит другому пользователю.")
            return
        except ValueError:
            await message.answer("Задача не найдена.")
            return
    await message.answer(
        f"Возобновлено по задаче #{task_id}. Таймер #{entry.id}. Начало: {_fmt_dt(entry.start_time)}"
    )
