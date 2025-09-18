import Link from 'next/link';

import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface GuideSection {
  title: string;
  description: string;
  bullets: string[];
}

interface Resource {
  title: string;
  summary: string;
  href: string;
  external?: boolean;
}

interface FaqItem {
  question: string;
  answer: string;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: 'Запуск за 30 минут',
    description: 'От создания рабочей области до настройки Telegram-бота и импорта существующих данных.',
    bullets: [
      'Шаблоны Areas и Projects по PARA, чек-лист подключения команды.',
      'Пошаговое описание init_app_once, переменных окружения и проксирования webhookов.',
      'Скрипты проверки окружения и контроль доступности PostgreSQL/Redis перед стартом.',
    ],
  },
  {
    title: 'Рабочий день «Сегодня»',
    description: 'Как связаны Calendar, Tasks, Habits и таймеры в общем рабочем фокусе.',
    bullets: [
      'Схемы данных с обязательными area_id/project_id и примеры наследования.',
      'Алгоритм cron для ежедневок и экономика XP/Gold/KP.',
      'Интеграция виджетов дашборда и настройка drag-n-drop через user_settings.',
    ],
  },
  {
    title: 'Технические гайды',
    description: 'Рекомендации по деплою, безопасности и расширению API.',
    bullets: [
      'Профили systemd для intdata-web и intdata-bot, health-check и логи.',
      'Политики CSP, настройка HTTPS и рекомендации по экспорту OpenAPI.',
      'Расширение core/services без нарушения runtime-инвариантов.',
    ],
  },
];

const API_RESOURCES: Resource[] = [
  {
    title: 'REST API v1',
    summary: 'Документация по /api/v1/* — структура запросов, фильтры и примеры ответов.',
    href: '/api/openapi.json',
  },
  {
    title: 'Webhooks и Integrations',
    summary: 'Сценарии приёма webhooks, обработка OAuth и правила idempotency ключей.',
    href: '#integrations',
  },
  {
    title: 'Песочница Postman',
    summary: 'Коллекция Postman с готовыми сценариями для команды, календаря и привычек.',
    href: 'https://intdata.pro/static/postman/intdata_v1.postman_collection.json',
    external: true,
  },
];

const SUPPORT_RESOURCES: Resource[] = [
  {
    title: 'База знаний',
    summary: 'Статьи для пользователей: основы PARA, роли участников и best practices.',
    href: '#knowledge-base',
  },
  {
    title: 'Чек-лист внедрения',
    summary: 'PDF чек-лист миграции вашего отдела в Intelligent Data Pro.',
    href: 'https://intdata.pro/static/docs/idp-onboarding-checklist.pdf',
    external: true,
  },
  {
    title: 'Поддержка команды',
    summary: 'Отдельный канал для вопросов: SLA 4 часа в рабочих планах Enterprise.',
    href: 'mailto:hello@intdata.pro?subject=Вопрос%20по%20документации',
    external: true,
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Документация доступна без авторизации?',
    answer: 'Да, лендинг и ключевые руководства открыты для просмотра. Для частных страниц загрузите токен из админки.',
  },
  {
    question: 'Как синхронизировать изменения?',
    answer: 'Новые версии выгружаются вместе с релизом: подписывайтесь на docs/CHANGELOG.md или RSS-канал обновлений.',
  },
  {
    question: 'Можно ли развернуть офлайн?',
    answer: 'Да, инструкция для self-hosting и минимальных зависимостей входит в раздел «Технические гайды».',
  },
];

export default function DocsLanding() {
  return (
    <div className="flex flex-col gap-24">
      <section className="grid gap-10 rounded-3xl bg-gradient-to-br from-[#ecf4ff] via-[#f5f3ff] to-[#fff7ed] p-10 shadow-soft">
        <div className="flex flex-col gap-6 text-center md:text-left">
          <Badge tone="accent" size="md" className="self-center md:self-start">
            Документация • Гайды • API
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--text-primary)] md:text-5xl">
            Документация Intelligent Data Pro: от онбординга до API
          </h1>
          <p className="text-lg text-muted md:text-xl">
            Собрали лучшие практики, схемы данных и интеграции, чтобы ваша команда запустилась быстро и
            поддерживала PARA-инварианты без ручной рутины.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/api/openapi.json"
              prefetch={false}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--accent-on-primary)] shadow-soft transition-base hover:opacity-90"
            >
              Открыть OpenAPI
            </Link>
            <Link
              href="https://intdata.pro/static/docs/idp-onboarding-checklist.pdf"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-subtle px-6 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition-base hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
              prefetch={false}
              target="_blank"
              rel="noreferrer"
            >
              Скачать чек-лист внедрения
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Структура руководств</h2>
          <p className="text-base text-muted">
            Каждый раздел содержит пошаговые инструкции, чек-листы и ссылки на сопутствующие файлы в репозитории.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          {GUIDE_SECTIONS.map((section) => (
            <Card key={section.title} className="flex flex-col gap-4 bg-white/80 p-6 shadow-soft backdrop-blur">
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">{section.title}</h3>
                <p className="text-sm text-muted">{section.description}</p>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-muted">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="leading-relaxed">{bullet}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section id="integrations" className="grid gap-6">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">API и интеграции</h2>
          <p className="text-base text-muted">
            Обновляем OpenAPI вместе с релизами и публикуем коллекции для быстрого тестирования.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          {API_RESOURCES.map((resource) => (
            <Card key={resource.title} className="flex flex-col gap-3 bg-white/80 p-6 shadow-soft backdrop-blur">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">{resource.title}</h3>
                <p className="text-sm text-muted">{resource.summary}</p>
              </div>
              <Link
                href={resource.href}
                prefetch={false}
                className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--accent-primary)] hover:underline"
                target={resource.external ? '_blank' : undefined}
                rel={resource.external ? 'noreferrer' : undefined}
              >
                Открыть
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section id="knowledge-base" className="grid gap-6">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Ресурсы поддержки</h2>
          <p className="text-base text-muted">
            Материалы для обучения команды и коммуникации с поддержкой Intelligent Data Pro.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          {SUPPORT_RESOURCES.map((resource) => (
            <Card key={resource.title} className="flex flex-col gap-3 bg-white/80 p-6 shadow-soft backdrop-blur">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">{resource.title}</h3>
                <p className="text-sm text-muted">{resource.summary}</p>
              </div>
              <Link
                href={resource.href}
                prefetch={false}
                className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--accent-primary)] hover:underline"
                target={resource.external ? '_blank' : undefined}
                rel={resource.external ? 'noreferrer' : undefined}
              >
                Подробнее
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">FAQ</h2>
          <p className="text-base text-muted">Ответы на частые вопросы продуктовых команд и интеграторов.</p>
        </header>
        <div className="grid gap-4">
          {FAQ_ITEMS.map((item) => (
            <Card key={item.question} className="flex flex-col gap-2 bg-white/80 p-6 shadow-soft backdrop-blur">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{item.question}</h3>
              <p className="text-sm text-muted leading-relaxed">{item.answer}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
