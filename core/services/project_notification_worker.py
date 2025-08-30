import asyncio
from sqlalchemy import select

from core import db
from core.models import (
    NotificationTrigger,
    NotificationDelivery,
    Alarm,
    CalendarItem,
    ProjectNotification,
    NotificationChannel,
)
from core.utils import utcnow
from .TG_BOT import TelegramBotClient


class ProjectNotificationWorker:
    """Простой воркер опроса таблицы триггеров."""

    def __init__(self, poll_interval: float = 60.0) -> None:
        self.poll_interval = poll_interval
        self.bot = TelegramBotClient()

    async def run_once(self) -> None:
        async with db.async_session() as session:
            now = utcnow()
            res = await session.execute(
                select(NotificationTrigger).where(NotificationTrigger.next_fire_at <= now)
            )
            triggers = res.scalars().all()
            for trig in triggers:
                exists = await session.scalar(
                    select(NotificationDelivery.id).where(
                        NotificationDelivery.dedupe_key == trig.dedupe_key
                    )
                )
                if exists:
                    continue
                await self._handle_trigger(session, trig)
                session.add(NotificationDelivery(dedupe_key=trig.dedupe_key))
                await session.delete(trig)
            await session.commit()

    async def _handle_trigger(self, session, trig: NotificationTrigger) -> None:
        if trig.alarm_id is None:
            return
        alarm = await session.get(Alarm, trig.alarm_id)
        if not alarm:
            return
        item = await session.get(CalendarItem, alarm.item_id)
        if not item or item.project_id is None:
            return
        res = await session.execute(
            select(ProjectNotification, NotificationChannel)
            .join(NotificationChannel, ProjectNotification.channel_id == NotificationChannel.id)
            .where(ProjectNotification.project_id == item.project_id)
            .where(ProjectNotification.is_enabled)
        )
        for pn, channel in res.all():
            chat_id = channel.address.get("chat_id") if channel.address else None
            if chat_id is None:
                continue
            text = f"{item.title} — {item.start_at:%Y-%m-%d %H:%M}"
            await self.bot.send_message(chat_id, text, silent=False)

    async def start(self) -> None:
        while True:
            await self.run_once()
            await asyncio.sleep(self.poll_interval)
