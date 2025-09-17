import Link from 'next/link';
import PageLayout from '../components/PageLayout';

const MODULE_TITLE = 'Обзор';
const MODULE_DESCRIPTION =
  'Быстро оценивайте состояние вашего рабочего пространства и переходите к ключевым разделам.';

const shortcuts = [
  {
    href: '/inbox',
    title: 'Входящие',
    description: 'Просмотрите свежие заметки и распределите их по Areas и Projects.',
    badge: 'новый UI',
  },
  {
    href: '/projects',
    title: 'Проекты',
    description: 'Создавайте проекты и управляйте структурой PARA в современном интерфейсе.',
    badge: 'новый UI',
  },
  {
    href: '/users',
    title: 'Команда',
    description: 'Смотрите профили участников, их роли и резюме в одном списке.',
    badge: 'новый UI',
  },
  {
    href: '/resources',
    title: 'Ресурсы',
    description: 'Храните артефакты и ссылки по проектам в едином каталоге.',
    badge: 'новый UI',
  },
  {
    href: '/tasks',
    title: 'Задачи',
    description: 'Следите за статусами, запускайте таймеры и закрывайте задачи быстрее.',
    badge: 'новый UI',
  },
  {
    href: '/habits',
    title: 'Привычки',
    description: 'Отмечайте выполнение ритуалов, следите за XP/Gold и планируйте апгрейды экономики.',
    badge: 'новый UI',
  },
];

export default function Home() {
  return (
    <PageLayout
      title={MODULE_TITLE}
      description={MODULE_DESCRIPTION}
      contentClassName="flex flex-col gap-6 p-6 md:p-8"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex h-full flex-col justify-between gap-3 rounded-2xl border border-subtle bg-surface-soft p-5 transition-base hover:-translate-y-1 hover:bg-[var(--surface-0)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{item.title}</h2>
              {item.badge ? (
                <span className="rounded-full bg-[var(--accent-primary-soft)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[var(--text-primary)]">
                  {item.badge}
                </span>
              ) : null}
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
        ))}
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
