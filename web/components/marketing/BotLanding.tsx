import Link from 'next/link';

import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { cn } from '../../lib/cn';

interface Metric {
  label: string;
  value: string;
  description: string;
}

interface Feature {
  title: string;
  description: string;
  icon: string;
}

interface UseCase {
  title: string;
  summary: string;
  bullets: string[];
}

interface Step {
  title: string;
  description: string;
}

const TELEGRAM_URL = 'https://t.me/intDataBot';
const COMMUNITY_URL = 'https://t.me/intDataHELP';
const SUPPORT_URL = 'https://t.me/HELPintData';
const DEVELOPER_URL = 'https://t.me/leotechru';

const HERO_METRICS: Metric[] = [
  {
    label: 'Захват',
    value: '7 секунд',
    description: 'Команда /note сохраняет мысли и файлы прямо в Inbox.',
  },
  {
    label: 'Автопилот',
    value: '24/7',
    description: 'Напоминания и контроль дедлайнов работают без участия оператора.',
  },
  {
    label: 'Команда',
    value: '∞ чатов',
    description: 'Подключайте рабочие группы и отделы без ограничений по количеству.',
  },
];

const FEATURE_ROWS: Feature[] = [
  {
    title: 'Контекст в PARA',
    description:
      'Каждая заметка, задача или привычка сразу наследует Area/Project, поэтому порядок не теряется.',
    icon: '🗂️',
  },
  {
    title: 'Контроль дедлайнов',
    description:
      'Сценарии /task_due и /task_control напоминают до срока, фиксируют результат и уведомляют наблюдателей.',
    icon: '⏱️',
  },
  {
    title: 'Сценарии захвата',
    description:
      'Команды /note, /task, /habit, /area позволяют пополнять базу знаний, не открывая веб-интерфейс.',
    icon: '⚡',
  },
  {
    title: 'Рассылки и дайджесты',
    description:
      'Еженедельные обзоры прогресса отправляются автоматически и показывают рисковые зоны.',
    icon: '📬',
  },
  {
    title: 'Интеграция с календарём',
    description:
      'События и таймеры синхронизируются с модулем Calendar и ICS-подписками.',
    icon: '📆',
  },
  {
    title: 'Безопасность',
    description:
      'Данные проходят через единое ядро Intelligent Data Pro и хранятся в PostgreSQL с аудитом.',
    icon: '🛡️',
  },
  {
    title: 'Комьюнити и поддержка',
    description:
      `Поддержка доступна 24/7: открытое сообщество ${COMMUNITY_URL}, выделенный канал ${SUPPORT_URL} для платных тарифов и прямой контакт с разработчиком ${DEVELOPER_URL} для Pro/Enterprise.`,
    icon: '🤝',
  },
];

const USE_CASES: UseCase[] = [
  {
    title: 'Личный фокус и ревью',
    summary: 'Соберите личные привычки, задачи и дневник, чтобы не терять рутину.',
    bullets: [
      'Быстрые голосовые заметки превращаются в структурированные задачи и ресурсы.',
      'Еженедельный дайджест напоминает про цели, которые не попали в расписание.',
      'Команда /habit up/down поддерживает геймификацию и экономику XP/Gold.',
    ],
  },
  {
    title: 'Командные проекты и продажи',
    summary: 'Держите лидов, запросы клиентов и контрольные точки в одном чате.',
    bullets: [
      'Маркируйте каждое обращение проектом или Area, чтобы видеть ответственных.',
      'Команда /watch подключает наблюдателей: менеджер получает оповещение автоматически.',
      'Пересланные сообщения сохраняются с ссылкой на оригинальный чат и автора.',
    ],
  },
  {
    title: 'Операционный контроль',
    summary: 'Закрывайте повторяющиеся процессы без ручной рутины.',
    bullets: [
      'Регламентные задачи приходят с контролем до и после дедлайна.',
      'Уведомления уходят в групповые чаты или личные диалоги сотрудникам.',
      'Статусы «активна / завершена / не будет выполнена» фиксируются для аудита.',
    ],
  },
];

const ONBOARDING_STEPS: Step[] = [
  {
    title: 'Добавьте бота в чат',
    description: 'Пригласите @intDataBot в рабочий диалог или начните личную переписку.',
  },
  {
    title: 'Свяжите с рабочей областью',
    description: 'Выполните /start в Telegram и подтвердите авторизацию по ссылке из веб-приложения.',
  },
  {
    title: 'Настройте сценарии',
    description: 'В разделе «Интеграции» выберите, какие команды доступны и кто получает дайджесты.',
  },
];

const AUTOMATION_EVENTS: Step[] = [
  {
    title: 'Контроль задач',
    description: 'Напоминания до срока, пост-контроль и сбор результата в PARA автоматически.',
  },
  {
    title: 'Привычки и геймификация',
    description: 'Команды /habit up/down начисляют XP, Gold и поддерживают экономику привычек.',
  },
  {
    title: 'Календарь и ICS',
    description: 'Совмещайте расписание, ежедневки и уведомления в одном фиде agenda/feed.ics.',
  },
  {
    title: 'Наблюдатели и эскалации',
    description: 'Добавляйте коллег в /watch, чтобы они получали уведомления и могли отказаться от задач.',
  },
];

export default function BotLanding() {
  return (
    <div className="flex flex-col gap-24">
      <section className="grid gap-10 rounded-3xl bg-gradient-to-br from-[#ecf4ff] via-[#f5f3ff] to-[#fff7ed] p-10 shadow-soft">
        <div className="grid gap-6 text-center md:grid-cols-[1.2fr_0.8fr] md:text-left">
          <div className="flex flex-col gap-6">
            <Badge tone="accent" size="md" className="self-center md:self-start">
              Telegram • PARA • Automation
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-[var(--text-primary)] md:text-5xl">
              Бесшовный Telegram-бот для Intelligent Data Pro
            </h1>
            <p className="text-lg text-muted md:text-xl">
              Записывайте идеи, запускайте процессы и держите контроль над дедлайнами прямо из Telegram.
              @intDataBot синхронизирован с веб-интерфейсом и поддерживает все PARA-инварианты. Возникают вопросы — есть
              сообщество {COMMUNITY_URL} и выделенная поддержка для клиентов.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--accent-on-primary)] shadow-soft transition-base hover:opacity-90"
              >
                Открыть @intDataBot
              </a>
              <Link
                href="/tariffs"
                prefetch={false}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-subtle px-6 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition-base hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
              >
                Узнать про тарифы
              </Link>
            </div>
          </div>
          <div className="grid gap-4 rounded-3xl border border-white/70 bg-white/70 p-6 text-left shadow-soft backdrop-blur">
            <span className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-primary)]">
              Метрики использования
            </span>
            <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-1">
              {HERO_METRICS.map((metric) => (
                <div key={metric.label} className="flex flex-col gap-1 rounded-2xl bg-surface p-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">{metric.label}</span>
                  <span className="text-2xl font-semibold text-[var(--text-primary)]">{metric.value}</span>
                  <p className="text-sm text-muted">{metric.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8">
        <div className="flex flex-col gap-3 text-center">
          <h2 className="text-3xl font-semibold text-[var(--text-primary)]">Что можно автоматизировать</h2>
          <p className="text-lg text-muted">
            Бот и веб-ядро работают на одном API, поэтому действия из чатов мгновенно появляются в Intelligent Data Pro.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {FEATURE_ROWS.map((feature) => (
            <Card key={feature.title} className="flex h-full flex-col gap-3 p-6">
              <span className="text-2xl" aria-hidden>{feature.icon}</span>
              <h3 className="text-xl font-semibold text-[var(--text-primary)]">{feature.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-10">
        <div className="flex flex-col gap-3 text-center">
          <h2 className="text-3xl font-semibold text-[var(--text-primary)]">Как подключить @intDataBot</h2>
          <p className="text-lg text-muted">
            Простая последовательность шагов, чтобы за пять минут ввести бота в работу команды.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {ONBOARDING_STEPS.map((step, index) => (
            <div
              key={step.title}
              className={cn(
                'flex flex-col gap-3 rounded-2xl border border-subtle bg-surface-soft p-6 text-left shadow-soft',
                index === 0 && 'md:translate-y-2',
                index === 2 && 'md:-translate-y-2',
              )}
            >
              <Badge tone="neutral" size="sm">
                {String(index + 1).padStart(2, '0')}
              </Badge>
              <h3 className="text-xl font-semibold text-[var(--text-primary)]">{step.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8">
        <div className="flex flex-col gap-3 text-center">
          <h2 className="text-3xl font-semibold text-[var(--text-primary)]">Кому особенно полезно</h2>
          <p className="text-lg text-muted">
            Сценарии собраны на основе опыта команд знаний, продуктовых студий и учебных сообществ.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {USE_CASES.map((useCase) => (
            <Card key={useCase.title} className="flex h-full flex-col gap-4 p-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">{useCase.title}</h3>
                <p className="text-sm text-muted">{useCase.summary}</p>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-[var(--text-primary)]">
                {useCase.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="mt-1.5 text-[var(--accent-primary)]">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-8">
        <div className="flex flex-col gap-3 text-center">
          <h2 className="text-3xl font-semibold text-[var(--text-primary)]">Автоматизация процессов</h2>
          <p className="text-lg text-muted">
            Поддерживаем автоматические сценарии, чтобы не терять контроль, даже если чат оживлён круглосуточно.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {AUTOMATION_EVENTS.map((event) => (
            <Card key={event.title} className="flex h-full flex-col gap-3 p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{event.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{event.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-white/60 bg-white/80 p-10 text-center shadow-soft backdrop-blur">
        <div className="flex flex-col gap-3">
          <h2 className="text-3xl font-semibold text-[var(--text-primary)]">Готовы подключить бот к рабочему процессу?</h2>
          <p className="text-lg text-muted">
            Откройте @intDataBot, выполните /start и назначьте команду. Если нужна помощь с внедрением — оставьте заявку, и мы соберём сценарии под вашу отрасль.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--accent-on-primary)] shadow-soft transition-base hover:opacity-90"
          >
            Запустить @intDataBot
          </a>
          <a
            href="mailto:hello@intdata.pro?subject=Внедрение%20Telegram%20бота"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-subtle px-6 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition-base hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
          >
            Запросить внедрение
          </a>
        </div>
      </section>
    </div>
  );
}
