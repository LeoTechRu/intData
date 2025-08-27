from __future__ import annotations

from datetime import datetime

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy import select

from core.models import TimeEntry
from core.services.time_service import TimeService


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
    now = datetime.utcnow()
    for e in entries:
        end = e.end_time or now
        delta = end - (e.start_time or end)
        mins = int(delta.total_seconds() // 60)
        status = "идёт" if e.end_time is None else "завершён"
        lines.append(
            f"#{e.id} [{status}] {_fmt_dt(e.start_time)} — {_fmt_dt(e.end_time)}"
            f" • {mins} мин • {e.description or '—'}"
        )
    await message.answer("\n".join(lines))

