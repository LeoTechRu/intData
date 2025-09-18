import Link from 'next/link';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface HeroStat {
  label: string;
  value: string;
  description: string;
  referenceLabel: string;
  referenceHref: string;
}

interface MethodologyBlock {
  id: string;
  pill: string;
  title: string;
  description: string;
  references: { label: string; href: string }[];
  persona: string;
}

interface UiPrinciple {
  title: string;
  description: string;
  reference: { label: string; href: string };
}

interface PlanMapping {
  plan: string;
  description: string;
  features: string[];
}

interface ResourceLink {
  label: string;
  href: string;
  external?: boolean;
}

const COMMUNITY_URL = 'https://t.me/intDataHELP';
const SUPPORT_URL = 'https://t.me/HELPintData';
const DEVELOPER_URL = 'https://t.me/leotechru';

const heroStats: HeroStat[] = [
  {
    label: 'Время на поиск информации',
    value: '−19 %',
    description:
      'McKinsey показывает, что почти пятая часть рабочего дня уходит на поиски документов. PARA и структурированный портал сокращают эти потери.',
    referenceLabel: 'McKinsey workplace study',
    referenceHref: 'https://www.cnbc.com/2012/08/01/workers-spend-onefourth-of-workday-reading-responding-to-email-survey.html',
  },
  {
    label: 'Экономия времени с ИИ',
    value: '−25 %',
    description:
      'Полевой эксперимент с генеративным ИИ снизил время на email на четверть. Интеграция AI-помощников в PARA-папки ускоряет документооборот.',
    referenceLabel: 'Shifting Work Patterns with Generative AI',
    referenceHref: 'https://arxiv.org/abs/2504.11436',
  },
  {
    label: 'Удержание после геймификации',
    value: '+75 %',
    description:
      'Долгосрочные привычки формируются при поддержке геймификации: участники образовательного челленджа сохраняли активность на 75 % выше через 12 недель.',
    referenceLabel: 'Digital interventions & habit formation',
    referenceHref: 'https://arxiv.org/abs/2310.10850',
  },
];

const methodologyBlocks: MethodologyBlock[] = [
  {
    id: 'para',
    pill: 'PARA как операционная система знаний',
    title: 'Projects, Areas, Resources, Archives — четыре контейнера, которые исключают хаос',
    description:
      'PARA от Tiago Forte организует данные по степени действия: всё, что требует результата, попадает в Projects, а Areas обеспечивают неизменную ответственность. В Intelligent Data Pro мы делаем `area_id` обязательным полем и наследуем проектный контекст в задачах и заметках — это устраняет «ничейные» элементы и ускоряет поиск.',
    references: [
      { label: 'Forte Labs — The PARA Method', href: 'https://fortelabs.com/blog/para/' },
      { label: 'Forte Labs Help Center', href: 'https://help.fortelabs.com/hc/en-us/articles/18183648465293' },
    ],
    persona:
      'Методисты, тимлиды и операционные директора, которым нужна единая карта знаний без дублирования между командами.',
  },
  {
    id: 'zettelkasten',
    pill: 'Zettelkasten в заметках',
    title: 'Атомарные заметки + граф связей = база знаний команды',
    description:
      'Zettelkasten Никласа Лумана опирается на атомарные карточки и обязательные связи. В нашем модуле «Заметки» это реализовано через бэклинки, граф и wikilinks, что позволяет превращать личные карточки в коллективную базу знаний и ускоряет онбординг.',
    references: [
      { label: 'Atlassian: Zettelkasten Guide', href: 'https://www.atlassian.com/blog/productivity/zettelkasten-method' },
      { label: 'Zettelkasten.de — Introduction', href: 'https://zettelkasten.de/introduction' },
    ],
    persona: 'Аналитики, исследователи и продуктовые команды, которые строят «второй мозг» и делятся выводами через граф знаний.',
  },
  {
    id: 'productivity-science',
    pill: 'Научные эффекты продуктивности',
    title: 'Измеримые метрики: меньше поиска, больше сфокусированной работы',
    description:
      'McKinsey фиксирует, что без систематизации уходит до 9.3 часов в неделю на поиск данных. Исследование generative AI показывает, что структурированная база + ИИ сокращают рутину, а геймифицированные привычки поддерживают вовлечённость через месяцы после запуска.',
    references: [
      { label: 'McKinsey workplace productivity', href: 'https://www.cnbc.com/2012/08/01/workers-spend-onefourth-of-workday-reading-responding-to-email-survey.html' },
      { label: 'Generative AI work patterns', href: 'https://arxiv.org/abs/2504.11436' },
      { label: 'Digital habit interventions', href: 'https://arxiv.org/abs/2310.10850' },
    ],
    persona: 'HR и операционные директора, оправдывающие инвестиции в знаниевую платформу метриками снижения потерь и роста удержания.',
  },
];

const uiPrinciples: UiPrinciple[] = [
  {
    title: 'Персональные дорожки документации',
    description:
      'Persona-based walkthroughs и интерактивные демо повышают adoption — мы используем их в модальном onboarding и кастомных гайдах.',
    reference: {
      label: 'UXPin — Design Doc Best Practices',
      href: 'https://www.uxpin.com/studio/blog/7-best-practices-for-design-system-documentation',
    },
  },
  {
    title: 'Адаптивные макеты 2025 года',
    description:
      'Сетки repeat(auto-fit, minmax(320px, 1fr)) и sticky-навигация удерживают CTA в зоне видимости на любом экране.',
    reference: {
      label: 'The66th — Web Design Best Practices 2025',
      href: 'https://www.the66th.com/journal/best-web-design-practices',
    },
  },
  {
    title: 'Производительность и доступность',
    description:
      'Скорость <3 секунд, переменные шрифты и соответствие WCAG 2.2 стали стандартом документации в 2025 году.',
    reference: {
      label: 'Codepaper — Responsive Design 2025',
      href: 'https://codepaper.com/blog/responsive-web-design-best-practices-for-2025/',
    },
  },
];

const planMapping: PlanMapping[] = [
  {
    plan: 'Solo / Второй мозг',
    description:
      'Бесплатный тариф включает PARA-контейнеры, заметки с Zettelkasten-графом и модуль «Сегодня» для личного GTD.',
    features: [
      'Обязательные Areas/Projects во всех сущностях ускоряют поиск и отчётность.',
      'Zettelkasten-связи, бэклинки и wiki-нотации доступны без ограничений.',
      'HUD привычек и личный тайм-трекер с геймификацией уровня Habitica.',
    ],
  },
  {
    plan: 'Team / Команда',
    description:
      'Совместная работа и Subjective Overrides: делегирование задач, общие графы знаний и дайджесты по PARA.',
    features: [
      'Совместные Areas/Projects с наследованием доступов и кастомных ролей.',
      'Командные Zettelkasten-правила, ревью и контроль версий заметок.',
      'Еженедельные дайджесты в Telegram + аналитика нагрузки по Areas.',
    ],
  },
  {
    plan: 'Pro / Enterprise',
    description:
      'CRM, white-label и SLA. Методологии интегрируются с ERP/BI, а привычки попадают в KPI-дэшборды.',
    features: [
      'Экспорт PARA и графа знаний в BI-слои и внешние аналитические витрины.',
      'Геймификация настроек KPI с кастомными наградами и ролями.',
      'Поддержка закрытых контуров, SSO и расширенного аудита событий.',
    ],
  },
];

const resourceLinks: ResourceLink[] = [
  { label: 'OpenAPI спецификация Intelligent Data Pro', href: '/api/openapi.json' },
  { label: 'Сообщество в Telegram', href: COMMUNITY_URL, external: true },
  { label: 'Канал индивидуальной поддержки', href: SUPPORT_URL, external: true },
  { label: 'Прямой контакт с разработчиком', href: DEVELOPER_URL, external: true },
  { label: 'Гайд по тарифам', href: 'https://intdata.pro/tariffs', external: true },
  { label: 'Forte Labs — PARA Method', href: 'https://fortelabs.com/blog/para/', external: true },
  { label: 'Atlassian — Zettelkasten', href: 'https://www.atlassian.com/blog/productivity/zettelkasten-method', external: true },
  { label: 'Generative AI для рабочих процессов', href: 'https://arxiv.org/abs/2504.11436', external: true },
];

export default function DocsLanding() {
  const currentYear = new Date().getFullYear();
  return (
    <div className="flex flex-col gap-24" data-page="docs-landing">
      <section className="rounded-3xl border border-white/40 bg-white/80 px-6 py-16 shadow-xl backdrop-blur md:px-12">
        <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-6">
            <Badge className="w-fit bg-[var(--accent-primary)] text-[var(--accent-on-primary)] shadow-lg">
              Методологии + Документация
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] md:text-5xl lg:text-6xl">
              Документация Intelligent Data Pro
            </h1>
            <p className="max-w-2xl text-lg text-muted">
              PARA, Zettelkasten и геймифицированные привычки — в одной операционной системе продуктивности. Страница
              открыта без авторизации, делитесь с командой и клиентами.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/tariffs"
                prefetch={false}
                className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--accent-primary)] px-7 text-base font-semibold text-[var(--accent-on-primary)] shadow-md transition-base hover:opacity-90"
              >
                Смотреть тарифы
              </Link>
              <Link
                href="/auth"
                prefetch={false}
                className="inline-flex h-12 items-center justify-center rounded-full border border-subtle px-7 text-base font-semibold text-[var(--text-primary)] shadow-sm transition-base hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
              >
                Начать бесплатно
              </Link>
            </div>
          </div>
          <Card
            padded={false}
            className="grid h-full gap-6 rounded-3xl border-none bg-gradient-to-br from-[#eef2ff] via-[#fdf2f8] to-[#fff7ed] p-8 shadow-inner"
          >
            {heroStats.map((stat) => (
              <article key={stat.label} className="flex flex-col gap-1">
                <span className="text-sm font-medium uppercase tracking-wide text-muted">{stat.label}</span>
                <span className="text-3xl font-semibold text-[var(--text-primary)]">{stat.value}</span>
                <p className="text-sm text-muted">{stat.description}</p>
                <a
                  href={stat.referenceHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm font-semibold text-[var(--accent-primary)] underline decoration-dotted decoration-1 underline-offset-4"
                >
                  {stat.referenceLabel}
                </a>
              </article>
            ))}
          </Card>
        </div>
      </section>

      <section className="grid gap-10 lg:grid-cols-[0.6fr_1.4fr]" id="methodologies">
        <aside className="sticky top-24 hidden h-full flex-col gap-4 self-start rounded-3xl border border-white/40 bg-white/70 p-8 text-sm font-medium text-muted backdrop-blur lg:flex">
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--accent-primary)]">Навигация</span>
          <a className="transition-base hover:text-[var(--accent-primary)]" href="#methodologies">
            Методологии и исследования
          </a>
          <a className="transition-base hover:text-[var(--accent-primary)]" href="#ui">
            Практики UI 2025
          </a>
          <a className="transition-base hover:text-[var(--accent-primary)]" href="#plans">
            Реализация по тарифам
          </a>
          <a className="transition-base hover:text-[var(--accent-primary)]" href="#resources">
            Исходники и ссылки
          </a>
        </aside>
        <div className="flex flex-col gap-10">
          {methodologyBlocks.map((block) => (
            <Card key={block.id} className="flex flex-col gap-6 border-white/60 bg-white/90 shadow-lg" data-section={block.id}>
              <div className="flex flex-col gap-3">
                <span className="inline-flex w-fit items-center rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent-primary)]">
                  {block.pill}
                </span>
                <h2 className="text-2xl font-semibold text-[var(--text-primary)]">{block.title}</h2>
                <p className="text-base leading-relaxed text-muted">{block.description}</p>
              </div>
              <ul className="grid gap-3 text-sm text-muted">
                {block.references.map((ref) => (
                  <li key={ref.href} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-[var(--accent-primary)]" aria-hidden />
                    <a
                      href={ref.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold text-[var(--accent-primary)] underline decoration-dotted decoration-1 underline-offset-4"
                    >
                      {ref.label}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted">{block.persona}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="ui" className="flex flex-col gap-6 rounded-3xl border border-white/40 bg-white/80 p-10 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-3">
          <h2 className="text-3xl font-semibold text-[var(--text-primary)]">UI-практики документации 2025</h2>
          <p className="max-w-3xl text-base text-muted">
            Мы консолидировали лучшие практики: адаптивная сетка, sticky-навигация, интерактивные демо и доступность. Так
            ваша документация повышает доверие и снижает нагрузку на поддержку.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {uiPrinciples.map((principle) => (
            <Card key={principle.title} className="flex flex-col gap-4 border-white/60 bg-white/90">
              <h3 className="text-xl font-semibold text-[var(--text-primary)]">{principle.title}</h3>
              <p className="text-sm text-muted">{principle.description}</p>
              <a
                href={principle.reference.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm font-semibold text-[var(--accent-primary)] underline decoration-dotted decoration-1 underline-offset-4"
              >
                {principle.reference.label}
              </a>
            </Card>
          ))}
        </div>
      </section>

      <section id="plans" className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h2 className="text-3xl font-semibold text-[var(--text-primary)]">Методологии в тарифах</h2>
          <p className="max-w-3xl text-base text-muted">
            PARA и Zettelkasten входят во все тарифы. Командные планы добавляют совместный контроль, а Pro/Enterprise
            масштабируют методологии на CRM и закрытые контуры.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {planMapping.map((plan) => (
            <Card key={plan.plan} className="flex flex-col gap-4 border-white/60 bg-white/90" data-plan={plan.plan}>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">{plan.plan}</h3>
                <p className="text-sm leading-relaxed text-muted">{plan.description}</p>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-muted">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-[var(--accent-primary)]" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/tariffs"
                prefetch={false}
                className="mt-auto inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--accent-on-primary)] transition-base hover:opacity-90"
              >
                Перейти к тарифам
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section id="resources" className="flex flex-col gap-6 rounded-3xl border border-white/40 bg-white/70 p-10 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-3">
          <h2 className="text-3xl font-semibold text-[var(--text-primary)]">Исходники и полезные материалы</h2>
          <p className="max-w-2xl text-base text-muted">
            Собрали официальные ресурсы и исследования, которые помогут внедрить методологии и аргументировать проект.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {resourceLinks.map((resource) => (
            <Card key={resource.href} className="flex flex-col gap-3 border-white/60 bg-white/90 p-6">
              <a
                href={resource.href}
                className="text-base font-semibold text-[var(--accent-primary)] underline decoration-dotted decoration-1 underline-offset-4"
                target={resource.external ? '_blank' : undefined}
                rel={resource.external ? 'noreferrer noopener' : undefined}
              >
                {resource.label}
              </a>
              <p className="text-sm text-muted">
                {resource.external
                  ? 'Внешний источник с доказательствами и примерами из индустрии.'
                  : 'Актуальная спецификация и артефакты продукта внутри Intelligent Data Pro.'}
              </p>
            </Card>
          ))}
        </div>
        <footer className="text-xs text-muted">
          © {currentYear} Intelligent Data Pro. Все методологии доступны в рамках соглашений и SLA выбранного тарифа.
        </footer>
      </section>
    </div>
  );
}
