'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageLayout from '../components/PageLayout';
import { StatusIndicator, type StatusIndicatorKind } from '../components/ui';

const MODULE_TITLE = 'Обзор';
const MODULE_DESCRIPTION =
  'Быстро оценивайте состояние вашего рабочего пространства и переходите к ключевым разделам.';

interface Shortcut {
  href: string;
  title: string;
  description: string;
  status?: {
    kind: StatusIndicatorKind;
    link?: string;
  };
}

const STATUS_TOOLTIPS: Record<StatusIndicatorKind, string> = {
  new: 'Новый раздел на современном интерфейсе',
  wip: 'Раздел в разработке — финальные штрихи ещё впереди',
  locked: 'Раздел доступен в расширенных тарифах Intelligent Data Pro',
};

const PAYWALL_ROUTE = '/pricing';

const shortcuts: Shortcut[] = [
  {
    href: '/inbox',
    title: 'Входящие',
    description: 'Просмотрите свежие заметки и распределите их по Areas и Projects.',
    status: { kind: 'new' },
  },
  {
    href: '/projects',
    title: 'Проекты',
    description: 'Создавайте проекты и управляйте структурой PARA в современном интерфейсе.',
    status: { kind: 'new' },
  },
  {
    href: '/users',
    title: 'Команда',
    description: 'Смотрите профили участников, их роли и резюме в одном списке.',
    status: { kind: 'new' },
  },
  {
    href: '/resources',
    title: 'Ресурсы',
    description: 'Храните артефакты и ссылки по проектам в едином каталоге.',
    status: { kind: 'wip' },
  },
  {
    href: '/tasks',
    title: 'Задачи',
    description: 'Следите за статусами, запускайте таймеры и закрывайте задачи быстрее.',
    status: { kind: 'wip' },
  },
  {
    href: '/habits',
    title: 'Привычки',
    description: 'Отмечайте выполнение ритуалов, следите за XP/Gold и планируйте апгрейды экономики.',
    status: { kind: 'locked', link: PAYWALL_ROUTE },
  },
];

export default function Home() {
  const router = useRouter();
  return (
    <PageLayout
      title={MODULE_TITLE}
      description={MODULE_DESCRIPTION}
      contentClassName="flex flex-col gap-6 p-6 md:p-8"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map((item) => {
          const status = item.status;
          let statusNode: ReactNode = null;
          if (status) {
            const tooltip = STATUS_TOOLTIPS[status.kind];
            if (status.link) {
              const link = status.link;
              statusNode = (
                <span
                  className="ml-2 inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
                  role="link"
                  tabIndex={0}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    router.push(link);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      router.push(link);
                    }
                  }}
                >
                  <StatusIndicator kind={status.kind} tooltip={tooltip} />
                </span>
              );
            } else {
              statusNode = <StatusIndicator kind={status.kind} tooltip={tooltip} />;
            }
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex h-full flex-col justify-between gap-3 rounded-2xl border border-subtle bg-surface-soft p-5 transition-base hover:-translate-y-1 hover:bg-[var(--surface-0)]"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{item.title}</h2>
                {statusNode}
              </div>
              <p className="text-sm text-muted">{item.description}</p>
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)]">
                Открыть
                <svg
                  aria-hidden
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 6l6 6-6 6" />
                </svg>
              </div>
            </Link>
          );
        })}
        <div className="rounded-2xl border border-dashed border-subtle text-sm text-muted">
          <div className="flex h-full flex-col items-start justify-center gap-2 p-5">
            <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              roadmap
            </span>
            <p>
              Следующий шаг модернизации — обновить профильные страницы и дочистить legacy-скрипты в `web/static`.
              Следите за прогрессом в бэклоге E17.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
