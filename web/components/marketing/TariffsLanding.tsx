'use client';

import Link from 'next/link';
import { type ReactNode, useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { cn } from '../../lib/cn';

type BillingCycle = 'monthly' | 'yearly';

type PlanMode = 'single' | 'multiplayer' | 'enterprise';

type FeatureValue = boolean | string;

interface Plan {
  id: PlanId;
  title: string;
  shortName: string;
  subtitle: string;
  audience: string;
  mode: PlanMode;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  yearlyEquivalentMonthly?: number | null;
  savingsNote?: string;
  highlight?: boolean;
  badge?: string;
  benefits: string[];
  outcomes: string[];
  cta: { label: string; href: string; external?: boolean };
  secondaryCta?: { label: string; href: string; external?: boolean };
}

type PlanId = 'solo' | 'team' | 'pro' | 'enterprise';

interface FeatureRow {
  id: string;
  title: string;
  description?: string;
  values: Record<PlanId, FeatureValue>;
}

type AnchorVariant = 'primary' | 'secondary' | 'ghost' | 'outline';
type AnchorSize = 'sm' | 'md' | 'lg';

interface AnchorButtonProps {
  href: string;
  children: ReactNode;
  variant?: AnchorVariant;
  size?: AnchorSize;
  fullWidth?: boolean;
  external?: boolean;
}

const BUTTON_BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60';

const BUTTON_VARIANT_CLASSES: Record<AnchorVariant, string> = {
  primary:
    'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-[var(--surface-0)] hover:opacity-90',
  secondary:
    'bg-surface-soft text-[var(--text-primary)] border border-subtle focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-[var(--surface-0)] hover:bg-[var(--surface-0)]',
  ghost:
    'bg-transparent text-[var(--text-primary)] hover:bg-surface-soft focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-[var(--surface-0)]',
  outline:
    'border border-subtle text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-[var(--surface-0)]',
};

const BUTTON_SIZE_CLASSES: Record<AnchorSize, string> = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-10 px-4',
  lg: 'h-11 px-5 text-base',
};

function AnchorButton({ href, children, variant = 'primary', size = 'md', fullWidth = false, external = false }: AnchorButtonProps) {
  const className = cn(
    BUTTON_BASE_CLASSES,
    BUTTON_VARIANT_CLASSES[variant],
    BUTTON_SIZE_CLASSES[size],
    fullWidth && 'w-full',
  );

  if (external) {
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  }

  return (
    <Link href={href} prefetch={false} className={className}>
      {children}
    </Link>
  );
}

const CONTACT_URL = 'https://t.me/leotechru';

const BILLING_CYCLES: Record<BillingCycle, { label: string; description: string; savings?: string }> = {
  monthly: {
    label: 'Ежемесячно',
    description: 'Гибкая оплата, можно менять тариф в любой месяц.',
  },
  yearly: {
    label: 'Годом',
    description: 'Экономия до двух месяцев при оплате вперёд.',
    savings: '−17 % при оплате за год',
  },
};

const CURRENCY = new Intl.NumberFormat('ru-RU');

const PLANS: Plan[] = [
  {
    id: 'solo',
    title: 'Solo / Второй мозг',
    shortName: 'Solo',
    subtitle: 'Личный контроль задач, заметок, календаря и привычек в одном интерфейсе.',
    audience: 'Создатели, консультанты, специалисты, которым нужен «второй мозг».',
    mode: 'single',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyEquivalentMonthly: 0,
    benefits: [
      'Все PARA-модули: задачи, календарь, заметки, привычки, тайм-трекер.',
      'Интеграции Google Calendar и Telegram-бота для быстрого захвата.',
      'Личные графы знаний и бэклинки без ограничения по объёму.',
    ],
    outcomes: [
      'Соберите личную ОС продуктивности без затрат.',
      'Синхронизируйте рабочий и личный календари в одном окне.',
    ],
    cta: { label: 'Начать бесплатно', href: CONTACT_URL, external: true },
    secondaryCta: { label: 'Смотреть возможности', href: '#compare' },
  },
  {
    id: 'team',
    title: 'Team / Команда',
    shortName: 'Team',
    subtitle: 'Совместные проекты, делегирование задач и общий календарь для команды до 25 человек.',
    audience: 'Кросс-функциональные команды, студии, стартапы на ранней стадии.',
    mode: 'multiplayer',
    monthlyPrice: 299,
    yearlyPrice: 2990,
    yearlyEquivalentMonthly: 249,
    savingsNote: 'Экономия 598 ₽ при оплате за год — почти два месяца в подарок.',
    highlight: true,
    badge: 'Хит команд',
    benefits: [
      'Общие Areas и Projects, ролевые права и делегирование задач.',
      'Командный календарь с напоминаниями, синхронизированный с Google Calendar.',
      'Уведомления и диджесты в Telegram, единая лента событий.',
    ],
    outcomes: [
      'Выровняйте повестку и дедлайны внутри команды.',
      'Сократите хаос в чатах — повестка дня и задачи в одной системе.',
    ],
    cta: { label: 'Попробовать для команды', href: CONTACT_URL, external: true },
    secondaryCta: { label: 'Скачать презентацию', href: 'https://intdata.pro/media/idp-team.pdf', external: true },
  },
  {
    id: 'pro',
    title: 'Pro / Профи',
    shortName: 'Pro',
    subtitle: 'CRM-процессы, аналитика и коммерческая лицензия для экспертов и агентств.',
    audience: 'Консалтинговые команды, коучи, студии, работающие с клиентами.',
    mode: 'multiplayer',
    monthlyPrice: 1000,
    yearlyPrice: 10000,
    yearlyEquivalentMonthly: 833,
    savingsNote: 'Экономия 2000 ₽ в год на одного пользователя при годовой оплате.',
    benefits: [
      'Встроенная CRM: контакты, воронки, кастомные поля и отчёты по доходности.',
      'Расширенная аналитика времени и загрузки команды, экспорт данных.',
      'Лицензия на коммерческое использование и встроенные автоматизации.',
    ],
    outcomes: [
      'Закройте воронку продаж и производство в одной системе.',
      'Отслеживайте маржинальность проектов и загрузку специалистов в реальном времени.',
    ],
    cta: { label: 'Запросить демо Pro', href: CONTACT_URL, external: true },
    secondaryCta: { label: 'Читать кейсы клиентов', href: '#stories' },
  },
  {
    id: 'enterprise',
    title: 'Enterprise / Бренд',
    shortName: 'Enterprise',
    subtitle: 'White-label, self-hosting, SLA и интеграции под процессы крупного бизнеса.',
    audience: 'Корпорации, образовательные сети, eco-системы с собственной экономикой.',
    mode: 'enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
    savingsNote: 'Оплата — минимальная подписка + 1 % от оборота, проведённого через платформу.',
    benefits: [
      'Индивидуальный брендинг, роли, согласования и доступы для нескольких юрлиц.',
      'Развёртывание в частном контуре, интеграции с 1С, ERP, CRM и BI-витринами.',
      'Выделенная поддержка 7×365, SLA 4 часа, выделенный менеджер успеха.',
    ],
    outcomes: [
      'Запустите корпоративную ОС продуктивности под вашим брендом.',
      'Свяжите продажи, обучение и сервисы в единой платформе без разработки с нуля.',
    ],
    cta: {
      label: 'Связаться с продакт-тимом',
      href: CONTACT_URL,
      external: true,
    },
    secondaryCta: {
      label: 'Скачать пакет Enterprise',
      href: 'https://intdata.pro/media/idp-enterprise.pdf',
      external: true,
    },
  },
];

const FEATURE_MATRIX: FeatureRow[] = [
  {
    id: 'para',
    title: 'PARA-структура и single-режим',
    values: {
      solo: true,
      team: true,
      pro: true,
      enterprise: true,
    },
  },
  {
    id: 'multiplayer',
    title: 'Совместные Areas/Projects и делегирование',
    values: {
      solo: false,
      team: true,
      pro: true,
      enterprise: true,
    },
  },
  {
    id: 'crm',
    title: 'CRM, сделки, коммерческая лицензия',
    values: {
      solo: false,
      team: 'Доступно в виде превью',
      pro: true,
      enterprise: 'Расширенные потоки + кастомные интеграции',
    },
  },
  {
    id: 'analytics',
    title: 'Аналитика времени и нагрузки',
    values: {
      solo: 'Базовые отчёты',
      team: 'Командные отчёты и экспорт CSV',
      pro: true,
      enterprise: 'BI-коннекторы и SLA по данным',
    },
  },
  {
    id: 'automations',
    title: 'Автоматизации и интеграции',
    values: {
      solo: 'Webhook, Telegram-бот',
      team: 'Telegram + Notion Import, Zapier (beta)',
      pro: 'Плюс финансовые модули и API',
      enterprise: 'Полноправный API + выделенные коннекторы',
    },
  },
  {
    id: 'hosting',
    title: 'Развёртывание и безопасность',
    values: {
      solo: 'Облачная среда IDP',
      team: 'Облачная среда IDP',
      pro: 'Изолированные среды и аудит',
      enterprise: 'Self-hosting / приватный кластер',
    },
  },
  {
    id: 'support',
    title: 'Поддержка и онбординг',
    values: {
      solo: 'Сообщество и база знаний',
      team: 'Групповой онбординг, приоритетная почта',
      pro: 'Выделенный Customer Success',
      enterprise: '24/7, SLA 4 часа, выделенная команда',
    },
  },
];

const FAQ_ITEMS = [
  {
    question: 'Можно ли начать бесплатно и потом перейти на командный тариф?',
    answer:
      'Да. Зарегистрируйтесь на Solo, подключите коллег когда будете готовы — данные и настройки сохранятся. Переход на Team/Pro мгновенный, оплату можно произвести картой или по счёту.',
  },
  {
    question: 'Как работает лицензия «1 % от оборота» в Enterprise?',
    answer:
      'Мы фиксируем минимальный ежемесячный платёж (обсуждается на пресейле) и берём 1 % от выручки, которую вы проводите через Intelligent Data Pro (оплаты клиентов, проданные слоты, подписки). Формула прозрачна и отражается в отчётах.',
  },
  {
    question: 'Какие ограничения у бесплатного тарифа?',
    answer:
      'Solo не ограничивает количество заметок, задач или календарных событий. Ограничены только совместная работа и доступ к продвинутой аналитике/CRM. Можно хранить до 10 ГБ файловых вложений, чего достаточно для личной работы.',
  },
  {
    question: 'Что включает командный онбординг?',
    answer:
      'Для Team мы проводим групповую сессию (до 60 минут) и настраиваем шаблоны проектов. Для Pro и Enterprise добавляем аудит процессов, помощь с импортом и подбором автоматизаций.',
  },
  {
    question: 'Можно ли платить в валюте?',
    answer:
      'Да. Для Team и Pro доступны оплаты в рублях, долларах и евро. Enterprise подписывается отдельным контрактом с мультивалютными условиями.',
  },
  {
    question: 'Есть ли образовательные или НКО-скидки?',
    answer:
      'Для образовательных программ и НКО предоставляем скидку 30 % на Team и Pro. Напишите нам на hello@intdata.pro с описанием проекта.',
  },
];

const TRUST_SIGNALS = [
  {
    id: 'harvard-award',
    title: 'Top Product Leader — Harvard Business Review',
    description: 'Команда Intelligent Data Pro отмечена HBR за стратегию развития платформы.',
  },
  {
    id: 'security',
    title: 'ISO-ready процессы безопасности',
    description: 'Производственный контур разделён, данные шифруются, бэкапы на трёх георегионах.',
  },
  {
    id: 'communities',
    title: '6 500+ активных workspace',
    description: 'Команды используют Intelligent Data Pro для продуктивности, обучения и сервисных бизнесов.',
  },
];

const ROI_SCENARIOS = [
  {
    id: 'consulting-team',
    title: 'Консалтинговая команда (6 человек)',
    description:
      'Команда экономит 6 часов в неделю на согласовании задач и таймшитах благодаря единым проектам и календарю.',
    input: '6 ч × 4 недели × 1 800 ₽ средняя ставка = 43 200 ₽ экономия в месяц.',
    output: 'Team окупается менее чем за неделю использования.',
  },
  {
    id: 'coaching-studio',
    title: 'Коучинговая студия (Pro)',
    description:
      'Автоматические воронки и CRM в Pro повышают конверсию продаж на 12 %. При среднем чеке 18 000 ₽ это +216 000 ₽ в квартал.',
    input: 'Стоимость Pro: 5 лицензий × 1 000 ₽ = 5 000 ₽/мес.',
    output: 'ROI > 400 % уже после второго месяца.',
  },
  {
    id: 'enterprise-network',
    title: 'Корпоративная сеть (Enterprise)',
    description:
      'Собственный бренд и self-hosting позволяют запустить экосистему услуг за 3 месяца вместо года внутренней разработки.',
    input: 'Экономия на разработке: 9 месяцев × 3 разработчика × 320 000 ₽ = 8,64 млн ₽.',
    output: 'Fee 1 % окупается за счёт ускоренного time-to-market.',
  },
];

function formatPrice(plan: Plan, billingCycle: BillingCycle): string {
  if (plan.monthlyPrice === 0 && billingCycle === 'monthly') {
    return 'Бесплатно';
  }

  if (plan.yearlyPrice === 0 && billingCycle === 'yearly') {
    return '0 ₽';
  }

  const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
  if (price == null) {
    return 'Индивидуально';
  }
  return `${CURRENCY.format(price)} ₽`;
}

function getPriceSuffix(plan: Plan, billingCycle: BillingCycle): string {
  if (plan.id === 'enterprise') {
    return 'Свяжитесь, чтобы рассчитать пакет под вашу модель.';
  }

  if (billingCycle === 'monthly') {
    return 'за пользователя в месяц';
  }

  if (plan.yearlyEquivalentMonthly != null) {
    return `за пользователя в год · ≈ ${CURRENCY.format(plan.yearlyEquivalentMonthly)} ₽/мес.`;
  }

  return 'за пользователя в год';
}

function renderFeatureValue(value: FeatureValue): ReactNode {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in srgb, var(--accent-primary) 12%, transparent)] text-[var(--accent-primary)]">
        <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    ) : (
      <span className="text-muted">—</span>
    );
  }

  return <span className="text-sm text-[var(--text-primary)]">{value}</span>;
}

export function TariffsLanding() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  const recommendedPlan = useMemo(() => PLANS.find((plan) => plan.highlight), []);

  return (
    <div className="flex flex-col gap-16">
      <section className="relative overflow-hidden rounded-3xl border border-[color-mix(in srgb, var(--accent-primary) 20%, transparent)] bg-gradient-to-br from-[color-mix(in srgb, var(--accent-primary) 16%, var(--surface-0) 84%)] via-[color-mix(in srgb, var(--accent-primary) 6%, transparent)] to-[var(--surface-0)] p-8 md:p-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-6">
            <Badge tone="accent" size="sm">Intelligent Data Pro</Badge>
            <div className="space-y-4">
              <p className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
                «Второй мозг» для личной продуктивности и командного масштаба.
              </p>
              <p className="text-lg text-[var(--text-primary)]/80">
                Соберите единое пространство для задач, календарей, заметок, привычек и CRM. Выбирайте тариф, который вырастет вместе с вашим бизнесом.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {recommendedPlan ? (
                <AnchorButton
                  href={recommendedPlan.cta.href}
                  size="lg"
                  external={recommendedPlan.cta.external}
                >
                  {recommendedPlan.cta.label}
                </AnchorButton>
              ) : null}
              <AnchorButton href="#plans" variant="ghost" size="lg">
                Посмотреть тарифы
              </AnchorButton>
            </div>
            <div className="flex flex-col gap-2 text-sm text-[var(--text-primary)]/70 md:flex-row md:items-center md:gap-6">
              <div className="flex items-center gap-2">
                <svg aria-hidden className="h-5 w-5 text-[var(--accent-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                </svg>
                <span>Запуск команды за 72 часа с персональным онбордингом.</span>
              </div>
              <div className="flex items-center gap-2">
                <svg aria-hidden className="h-5 w-5 text-[var(--accent-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Подтверждённый эффект: +12 % к скоростям командных релизов.</span>
              </div>
            </div>
          </div>
          <Card
            className="relative flex w-full max-w-sm flex-col gap-6 bg-[color-mix(in srgb, var(--surface-0) 85%, var(--accent-primary) 15%)]/80 p-6 backdrop-blur md:p-7"
            surface="soft"
            padded={false}
          >
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-primary)]">Управляйте гибко</p>
              <h3 className="text-2xl font-semibold text-[var(--text-primary)]">Гибкий биллинг</h3>
              <p className="text-sm text-[var(--text-primary)]/70">
                Переключайтесь между ежемесячной и годовой оплатой в один клик. Годовая подписка — до двух месяцев бесплатно и приоритет по roadmap.
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-0)] p-4 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                {Object.entries(BILLING_CYCLES).map(([cycle, meta]) => (
                  <button
                    key={cycle}
                    type="button"
                    className={cn(
                      'flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-base',
                      billingCycle === cycle
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] shadow-soft'
                        : 'bg-surface-soft text-[var(--text-primary)] hover:bg-[color-mix(in srgb, var(--accent-primary) 12%, transparent)]',
                    )}
                    aria-pressed={billingCycle === cycle}
                    onClick={() => setBillingCycle(cycle as BillingCycle)}
                  >
                    {meta.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">
                {BILLING_CYCLES[billingCycle].description}
                {BILLING_CYCLES[billingCycle].savings ? ` · ${BILLING_CYCLES[billingCycle].savings}` : ''}
              </p>
            </div>
          </Card>
        </div>
      </section>

      <section id="plans" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid gap-6 lg:grid-cols-2">
          {PLANS.map((plan) => {
            const price = formatPrice(plan, billingCycle);
            const suffix = getPriceSuffix(plan, billingCycle);
            return (
              <Card
                key={plan.id}
                className={cn(
                  'flex flex-col gap-6 p-6 transition-base hover:-translate-y-1 hover:shadow-lg',
                  plan.highlight && 'border-[var(--accent-primary)] bg-[color-mix(in srgb, var(--accent-primary) 10%, var(--surface-0) 90%)]',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold text-[var(--text-primary)]">{plan.title}</h3>
                      {plan.badge ? <Badge tone="accent" size="sm">{plan.badge}</Badge> : null}
                    </div>
                    <p className="text-sm text-muted">{plan.subtitle}</p>
                  </div>
                  <Badge tone={plan.mode === 'single' ? 'neutral' : plan.mode === 'enterprise' ? 'warning' : 'accent'} size="sm">
                    {plan.mode === 'single' ? 'Single' : plan.mode === 'enterprise' ? 'Enterprise' : 'Multiplayer'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-semibold text-[var(--text-primary)]">{price}</p>
                  <p className="text-sm text-muted">{suffix}</p>
                  {billingCycle === 'yearly' && plan.savingsNote ? (
                    <p className="text-xs font-medium text-[var(--accent-primary)]">{plan.savingsNote}</p>
                  ) : null}
                </div>
                <ul className="space-y-3 text-sm text-[var(--text-primary)]/85">
                  {plan.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2">
                      <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color-mix(in srgb, var(--accent-primary) 15%, transparent)] text-[var(--accent-primary)]">
                        <svg aria-hidden className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-3">
                  <AnchorButton
                    href={plan.cta.href}
                    fullWidth
                    size="lg"
                    external={plan.cta.external}
                  >
                    {plan.cta.label}
                  </AnchorButton>
                  {plan.secondaryCta ? (
                    <AnchorButton
                      href={plan.secondaryCta.href}
                      fullWidth
                      variant="ghost"
                      external={plan.secondaryCta.external}
                    >
                      {plan.secondaryCta.label}
                    </AnchorButton>
                  ) : null}
                </div>
                <div className="rounded-2xl bg-surface-soft p-4 text-sm text-muted">
                  <p className="font-medium text-[var(--text-primary)]">Результаты</p>
                  <ul className="mt-2 space-y-2">
                    {plan.outcomes.map((outcome) => (
                      <li key={outcome}>{outcome}</li>
                    ))}
                  </ul>
                </div>
              </Card>
            );
          })}
        </div>
        <aside className="flex h-full flex-col gap-6">
          <Card className="sticky top-24 flex flex-col gap-4 bg-[var(--surface-0)] p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-primary)]">Почему клиенты выбирают Intelligent Data Pro</p>
            <ul className="space-y-3 text-sm text-[var(--text-primary)]/85">
              <li>
                <strong>PARA-first.</strong> Структура Projects/Areas/Resources/Archive вшита в схему данных — никакого хаоса в тегах.
              </li>
              <li>
                <strong>Единый календарный стек.</strong> События, задачи и напоминания объединены, синхронизация с Google Calendar и Telegram.
              </li>
              <li>
                <strong>Режимы single/multiplayer.</strong> Легко переходить от личного use-case к команде, сохраняя контекст.
              </li>
              <li>
                <strong>Расширяемость.</strong> API, webhooks, фичефлаги для Habitica-экономики и CRM позволяют кастомизировать продукт под бизнес.
              </li>
            </ul>
          </Card>
          <Card className="flex flex-col gap-4 bg-[color-mix(in srgb, var(--accent-primary) 8%, transparent)] p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Доверие и социальное доказательство</h3>
            <ul className="space-y-3 text-sm text-[var(--text-primary)]/80">
              {TRUST_SIGNALS.map((signal) => (
                <li key={signal.id}>
                  <p className="font-medium text-[var(--text-primary)]">{signal.title}</p>
                  <p>{signal.description}</p>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </section>

      <section id="compare" className="rounded-3xl border border-subtle bg-[var(--surface-0)] p-6 md:p-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Сравните тарифы</h2>
            <p className="text-sm text-muted">Все планы строятся на одной схеме данных. Выбирайте глубину функций и поддержку.</p>
          </div>
          <AnchorButton href="#faq" variant="outline">
            Ответы на вопросы
          </AnchorButton>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-y-3">
            <thead>
              <tr>
                <th className="w-1/4 rounded-l-2xl bg-surface-soft p-4 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Возможность
                </th>
                {PLANS.map((plan, index) => (
                  <th
                    key={plan.id}
                    className={cn(
                      'bg-surface-soft p-4 text-left text-xs font-semibold uppercase tracking-wide text-muted',
                      index === PLANS.length - 1 && 'rounded-r-2xl',
                    )}
                  >
                    {plan.shortName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row) => (
                <tr key={row.id} className="rounded-2xl">
                  <td className="rounded-l-2xl bg-[color-mix(in srgb, var(--surface-0) 92%, var(--accent-primary) 8%)] p-4 text-sm font-medium text-[var(--text-primary)]">
                    <div>{row.title}</div>
                    {row.description ? <div className="text-xs text-muted">{row.description}</div> : null}
                  </td>
                  {PLANS.map((plan, index) => (
                    <td
                      key={plan.id}
                      className={cn(
                        'bg-[var(--surface-0)] p-4 text-center',
                        index === PLANS.length - 1 && 'rounded-r-2xl',
                      )}
                    >
                      {renderFeatureValue(row.values[plan.id])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="stories" className="grid gap-6 md:grid-cols-2">
        {ROI_SCENARIOS.map((scenario) => (
          <Card key={scenario.id} className="flex flex-col gap-3 p-6">
            <h3 className="text-xl font-semibold text-[var(--text-primary)]">{scenario.title}</h3>
            <p className="text-sm text-[var(--text-primary)]/80">{scenario.description}</p>
            <div className="rounded-2xl bg-surface-soft p-4 text-sm text-[var(--text-primary)]">
              <p className="font-medium">Расчёт</p>
              <p>{scenario.input}</p>
            </div>
            <p className="text-sm font-medium text-[var(--accent-primary)]">{scenario.output}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Чем мы отличаемся</h3>
          <ul className="mt-4 space-y-3 text-sm text-[var(--text-primary)]/80">
            <li><strong>Deep sync.</strong> Одновременная работа с Google Calendar, Telegram и email без дубликатов.</li>
            <li><strong>Habitica-подход.</strong> Геймификация привычек и тайм-трекера удерживает команду в ритме.</li>
            <li><strong>Knowledge graph.</strong> Бэклинки, wikilinks и поисковые срезы связаны с задачами и временем.</li>
            <li><strong>Roadmap.</strong> Модули «Финансы» и «Здоровье» подключаются первыми клиентам Pro/Enterprise.</li>
          </ul>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Частые вопросы</h3>
          <div id="faq" className="mt-4 space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-subtle bg-surface-soft p-4 transition-base open:border-[var(--accent-primary)] open:bg-[color-mix(in srgb, var(--accent-primary) 8%, var(--surface-0) 92%)]"
              >
                <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-[var(--text-primary)]">
                  {item.question}
                  <span className="ml-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-0)] text-[var(--accent-primary)] transition-transform group-open:rotate-45">
                    <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-[var(--text-primary)]/80">{item.answer}</p>
              </details>
            ))}
          </div>
        </Card>
      </section>

      <section className="rounded-3xl border border-[color-mix(in srgb, var(--accent-primary) 30%, transparent)] bg-gradient-to-r from-[color-mix(in srgb, var(--accent-primary) 18%, var(--surface-0) 82%)] to-[var(--surface-0)] p-8 text-center md:p-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
          <h2 className="text-3xl font-semibold text-[var(--text-primary)] md:text-4xl">Готовы подключить Intelligent Data Pro?</h2>
          <p className="text-lg text-[var(--text-primary)]/80">
            Расскажите о вашей команде и целях. Подготовим индивидуальный пилот, миграцию данных и план внедрения за 7 дней.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <AnchorButton href={CONTACT_URL} size="lg" external>
              Забронировать демо
            </AnchorButton>
            <AnchorButton href={CONTACT_URL} variant="outline" size="lg" external>
              Написать нам
            </AnchorButton>
          </div>
        </div>
      </section>
    </div>
  );
}

export default TariffsLanding;