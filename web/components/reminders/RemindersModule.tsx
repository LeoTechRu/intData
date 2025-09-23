'use client';

import Link from 'next/link';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusIndicator } from '../ui/StatusIndicator';

const SAMPLE_REMINDERS = [
  {
    id: 'r-1',
    title: 'Согласовать недельный обзор проектов',
    due: 'Сегодня, 18:00',
    scope: 'Проект: Modern CRM rollout',
    status: 'new' as const,
  },
  {
    id: 'r-2',
    title: 'Перезвонить Алексею по договору',
    due: '24 сентября, 09:30',
    scope: 'Контакт: Алексей Иванов',
    status: 'wip' as const,
  },
  {
    id: 'r-3',
    title: 'Обновить регламент для голосовых ассистентов',
    due: '26 сентября, 11:00',
    scope: 'Область: Operations',
    status: 'locked' as const,
  },
];

export default function RemindersModule() {
  return (
    <div className="flex flex-col gap-6" data-testid="reminders-module">
      <Card className="flex flex-col gap-4">
        <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Ближайшие напоминания</h2>
            <p className="text-sm text-muted">
              Управляйте уведомлениями по проектам, задачам и клиентам — всё в одном расписании Control Hub.
            </p>
          </div>
          <Link
            href="/tasks/new"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-3 text-xs font-medium text-[var(--accent-on-primary)] transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
          >
            Создать напоминание
          </Link>
        </header>
        <ul className="flex flex-col divide-y divide-subtle" role="list">
          {SAMPLE_REMINDERS.map((reminder) => (
            <li key={reminder.id} className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <StatusIndicator kind={reminder.status} className="mt-1 h-2 w-2" />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{reminder.title}</span>
                  <span className="text-xs uppercase tracking-wide text-muted">{reminder.scope}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted md:text-sm">
                <span className="font-medium text-[var(--text-primary)]">{reminder.due}</span>
                <Link
                  href="/tasks"
                  className="inline-flex h-8 items-center justify-center rounded-xl px-3 text-xs font-medium text-[var(--text-primary)] transition-base hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
                >
                  Открыть
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card surface="soft" className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Глобальные настройки</h2>
        <p className="text-sm text-muted">
          Здесь появятся каналы доставки (Telegram, почта, чат-бот) и правила синхронизации напоминаний с задачами,
          календарём и CRM. Администраторы смогут публиковать общие шаблоны и политики SLA.
        </p>
        <Button size="sm" variant="ghost" className="self-start" disabled>
          Настройки скоро появятся
        </Button>
      </Card>
    </div>
  );
}
