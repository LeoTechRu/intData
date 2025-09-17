'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useMutation, useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../lib/api';
import { cn } from '../../lib/cn';
import type { AuthConfigWarning, AuthFeedbackResponse, AuthOptionsPayload } from '../../lib/types';

interface AuthLandingProps {
  initialTab?: string | null;
  initialFlash?: string | null;
  initialValues?: Record<string, string> | null;
  initialErrors?: Record<string, string> | null;
  redirectHint?: string | null;
  nextUrl?: string | null;
}

type AuthTab = 'login' | 'signup' | 'restore';

const HERO_METRICS = [
  {
    title: 'До 12 часов в месяц экономии',
    description: 'Автоматизируйте повторяющиеся задачи и освобождайте фокусные слоты.',
  },
  {
    title: '3 интеграции без доплат',
    description: 'Подключите Telegram, календарь и напоминания сразу после регистрации.',
  },
  {
    title: '0 ₽ за базовый тариф',
    description: 'Все инструменты PARA, тайм-трекинг и заметки доступны бесплатно навсегда.',
  },
];

const FEATURE_GROUPS = [
  {
    title: 'Организация по PARA',
    description: 'Области, проекты, ресурсы и задачи объединены в единую систему с автоматическим наследованием связей.',
    bullets: [
      'Виджеты «Сегодня» и дашборд с drag-n-drop настройкой.',
      'Виртуальный календарь без дублирования ежедневок.',
      'Быстрый ввод с автоматическим попаданием во «Входящие».',
    ],
  },
  {
    title: 'Командная работа и прозрачность',
    description: 'Делитесь рабочими областями, назначайте права и собирайте аналитику активности без ограничения по участникам.',
    bullets: [
      'Трёхуровневая модель ролей и персональные избранные.',
      'Живые отчёты по Areas, Projects и времени.',
      'Недельные дайджесты и уведомления в Telegram.',
    ],
  },
  {
    title: 'Режим привычек Habitica-like',
    description: 'Превратите рутину в игру: XP, золото, здоровье и квесты для всей команды под одним брендом.',
    bullets: [
      'HUD с показателями (HP / XP / Gold / KP) прямо на странице.',
      'Мягкие лимиты против фарма и умные напоминания.',
      'Виртуальная интеграция с календарём и задачами.',
    ],
  },
];

const TESTIMONIALS = [
  {
    quote:
      'Intelligent Data Pro позволил нашей команде продукт-аналитиков синхронизировать задачи, привычки и отчётность в одном интерфейсе. Настройка заняла вечер, экономия времени стала заметна уже через неделю.',
    author: 'Светлана Петрова',
    role: 'Head of Analytics, Insight Labs',
  },
  {
    quote:
      'Мне нравится, что вход сразу показывает ценность продукта. Даже без оплаты мы получили дашборд «Сегодня» и автоматическое распределение задач по PARA без ручной работы.',
    author: 'Андрей Кузьмин',
    role: 'Product Lead, FinStack',
  },
  {
    quote:
      'Модуль привычек сэкономил отделу обучения десятки часов: сотрудники видят прогресс, а мы контролируем вовлечённость. Обновлённая страница регистрации помогает лучше конвертировать новых пользователей.',
    author: 'Елена Ким',
    role: 'HR Business Partner, Aurora Ops',
  },
];

const FAQ_ITEMS = [
  {
    question: 'Правда ли, что базовый тариф бесплатный?',
    answer:
      'Да, базовый доступ включает PARA-структуру, заметки, дашборд «Сегодня», тайм-трекинг, интеграцию с Telegram и командную работу. Платные опции нужны только для расширенной аналитики и геймификации.',
  },
  {
    question: 'Нужны ли банковские данные для старта?',
    answer: 'Нет. Регистрация мгновенная — создайте логин и пароль или войдите через Telegram. Оплату можно подключить позже из раздела тарифов.',
  },
  {
    question: 'Что входит в профессиональный уровень?',
    answer:
      'Продвинутые отчёты по Areas, автоматизации, интеграции с BI, доступ к модулю «Привычки RPG» и поддержка SLA. Также доступны персональные консультации и внедрение.',
  },
  {
    question: 'Как обеспечить безопасность доступа?',
    answer:
      'Все соединения по HTTPS, куки только с HTTP-only, поддерживаем reCAPTCHA, вход по магической ссылке и готовим поддержку passkeys. Вы можете включить обязательный Telegram SSO для команды.',
  },
];

const COMPARISON = {
  free: [
    'Парадигма PARA и неограниченные заметки',
    'Бесконечный журнал тайм-трекинга и «Сегодня»',
    'Интеграция с Telegram и магические ссылки',
  ],
  pro: [
    'Геймификация Habitica-вдохновлённого модуля',
    'Командные роли, RBAC и аналитика проектов',
    'Интеграции с BI, Google Calendar и API-доступ',
  ],
};

function isAuthTab(value: string | null | undefined): value is AuthTab {
  return value === 'login' || value === 'signup' || value === 'restore';
}

function TelegramLoginButton({
  enabled,
  username,
}: {
  enabled: boolean;
  username?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !username || !container) {
      return;
    }
    const normalized = username.replace(/^@/, '');
    container.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', normalized);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-auth-url', '/auth/tg/callback');
    script.setAttribute('data-lang', 'ru');
    container.appendChild(script);
    return () => {
      container.innerHTML = '';
    };
  }, [enabled, username]);
  return <div ref={containerRef} className="flex justify-center" aria-live="polite" />;
}

export default function AuthLanding({
  initialTab,
  initialFlash,
  initialValues,
  initialErrors,
  redirectHint,
  nextUrl,
}: AuthLandingProps) {
  const defaultTab: AuthTab = isAuthTab(initialTab) ? initialTab : 'login';
  const [activeTab, setActiveTab] = useState<AuthTab>(defaultTab);
  const [flash, setFlash] = useState<string | null>(initialFlash ?? null);
  const [errors, setErrors] = useState<Record<string, string>>(initialErrors ?? {});
  const [loginValues, setLoginValues] = useState({
    username: initialValues?.username ?? '',
    password: '',
  });
  const [magicEmail, setMagicEmail] = useState(initialValues?.email ?? initialValues?.username ?? '');
  const [configWarnings, setConfigWarnings] = useState<AuthConfigWarning[]>([]);
  const [magicSuccess, setMagicSuccess] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const nextValue = useMemo(() => nextUrl ?? redirectHint ?? '', [nextUrl, redirectHint]);

  useEffect(() => {
    if (initialFlash || (initialErrors && Object.keys(initialErrors).length > 0) || redirectHint) {
      if (typeof window === 'undefined') {
        return;
      }
      const params = new URLSearchParams(window.location.search);
      let mutated = false;
      ['flash', 'values', 'errors', 'tab', 'redirect'].forEach((key) => {
        if (params.has(key)) {
          params.delete(key);
          mutated = true;
        }
      });
      if (mutated) {
        const search = params.toString();
        const nextHref = `${window.location.pathname}${search ? `?${search}` : ''}`;
        window.history.replaceState({}, '', nextHref);
      }
    }
  }, [initialFlash, initialErrors, redirectHint]);

  const { data: options } = useQuery<AuthOptionsPayload>({
    queryKey: ['auth-options'],
    queryFn: async () => apiFetch<AuthOptionsPayload>('/api/v1/auth/options', { skipAuth: true }),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (options?.config_warnings) {
      setConfigWarnings(options.config_warnings);
    }
  }, [options?.config_warnings]);

  const loginMutation = useMutation<AuthFeedbackResponse, Error, FormData>({
    mutationFn: async (payload) => {
      const response = await fetch('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        body: payload,
      });
      try {
        const data = (await response.json()) as AuthFeedbackResponse;
        return data;
      } catch {
        throw new Error('Не удалось выполнить вход. Повторите попытку.');
      }
    },
    onSuccess: (data) => {
      setConfigWarnings(data.config_warnings ?? options?.config_warnings ?? []);
      if (data.ok) {
        setErrors({});
        setFlash(data.flash ?? null);
        if (data.redirect) {
          window.location.assign(data.redirect);
          return;
        }
      } else {
        setErrors(data.form_errors ?? {});
        setFlash(data.flash ?? null);
      }
    },
    onError: (error) => {
      setErrors({ username: error.message });
      setFlash(error.message);
    },
  });

  const magicMutation = useMutation<AuthFeedbackResponse, Error, FormData>({
    mutationFn: async (payload) => {
      const response = await fetch('/auth/magic/request', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: payload,
        credentials: 'include',
      });
      try {
        return (await response.json()) as AuthFeedbackResponse;
      } catch {
        throw new Error('Не удалось отправить магическую ссылку.');
      }
    },
    onSuccess: (data) => {
      setConfigWarnings(data.config_warnings ?? options?.config_warnings ?? []);
      setMagicSuccess(data.flash ?? 'Если email существует — отправили ссылку для входа.');
      setFlash(null);
    },
    onError: (error) => {
      setMagicSuccess(null);
      setFlash(error.message);
    },
  });

  const restoreMutation = useMutation<{ detail: string }, Error, string>({
    mutationFn: async (usernameValue) => {
      const payload = new URLSearchParams({ username: usernameValue });
      const response = await fetch('/auth/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload,
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Не удалось отправить напоминание.');
      }
      return (await response.json()) as { detail: string };
    },
    onSuccess: (data) => {
      setFlash(data.detail);
    },
    onError: (error) => {
      setFlash(error.message);
    },
  });

  const handleLoginSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFlash(null);
    setErrors({});
    const formData = new FormData(event.currentTarget);
    if (nextValue) {
      formData.set('next', nextValue);
    }
    loginMutation.mutate(formData);
  };

  const handleMagicSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFlash(null);
    setMagicSuccess(null);
    const formData = new FormData(event.currentTarget);
    const timestamp = Math.floor(Date.now() / 1000);
    formData.set('form_ts', String(timestamp));
    formData.set('hp_url', '');
    magicMutation.mutate(formData);
  };

  const handleRemind = () => {
    if (!loginValues.username) {
      setFlash('Напишите логин, чтобы отправить напоминание.');
      return;
    }
    restoreMutation.mutate(loginValues.username);
  };

  const scrollToForm = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setFlash(null);
    setErrors({});
    if (tab !== 'restore') {
      setMagicSuccess(null);
    }
    scrollToForm();
  };

  const badgeLabel = activeTab === 'signup' ? 'Регистрация' : 'Авторизация';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eef2ff] via-[#e0f2fe] to-[#fff7ed] text-[var(--text-primary)]">
      {options?.recaptcha_site_key ? (
        <Script src="https://www.google.com/recaptcha/api.js?hl=ru" async defer strategy="afterInteractive" />
      ) : null}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-primary)] text-lg font-semibold text-[var(--accent-on-primary)] shadow-soft">
            ID
          </span>
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight">Intelligent Data Pro</span>
            <span className="text-sm text-muted">Второй мозг для команд знаний</span>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
          <Link href="/pricing" className="transition-base hover:text-[var(--accent-primary)]">
            Тарифы
          </Link>
          <Link href="/docs" className="transition-base hover:text-[var(--accent-primary)]">
            Документация
          </Link>
          <Link href="https://intdata.pro/bot" className="transition-base hover:text-[var(--accent-primary)]" target="_blank" rel="noreferrer">
            @intDataBot
          </Link>
        </nav>
        <button
          type="button"
          onClick={() => switchTab('login')}
          className="hidden h-10 items-center rounded-full border border-subtle px-5 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition-base hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] md:flex"
        >
          Войти
        </button>
      </header>

      <main className="px-6 pb-16 pt-4 md:px-10 lg:px-16">
        <section className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-6 rounded-3xl bg-white/80 p-6 shadow-soft backdrop-blur md:p-10">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--accent-primary-soft)] px-4 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent-primary)]">
                {badgeLabel}
              </span>
              <h1 className="text-4xl font-semibold leading-tight text-[var(--text-primary)] md:text-5xl">
                Начните бесплатно и почувствуйте ценность ещё до регистрации
              </h1>
              <p className="max-w-2xl text-base text-muted md:text-lg">
                Intelligent Data Pro объединяет PARA, календарь, привычки и аналитику в одном рабочем пространстве. Регистрация занимает минуту, а доступ к основным модулям открыт сразу.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => switchTab('signup')}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--accent-on-primary)] shadow-soft transition-base hover:opacity-90"
                >
                  Начать бесплатно
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('restore')}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-transparent px-6 text-sm font-semibold text-[var(--accent-primary)] transition-base hover:border-[var(--accent-primary)]"
                >
                  Войти без пароля
                </button>
                <span className="text-xs uppercase tracking-wide text-muted">
                  Без карты • Без ограничений по команде
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {HERO_METRICS.map((metric) => (
                <div key={metric.title} className="flex flex-col gap-2 rounded-2xl bg-white/70 p-5 shadow-soft">
                  <span className="text-lg font-semibold text-[var(--text-primary)]">{metric.title}</span>
                  <p className="text-sm text-muted">{metric.description}</p>
                </div>
              ))}
            </div>

            <div className="space-y-10 rounded-3xl bg-white/80 p-6 shadow-soft md:p-10">
              {FEATURE_GROUPS.map((section) => (
                <div key={section.title} className="grid gap-4 md:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)] md:items-start">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-semibold text-[var(--text-primary)]">{section.title}</h2>
                    <p className="text-sm text-muted">{section.description}</p>
                  </div>
                  <ul className="space-y-2 text-sm text-[var(--text-primary)]">
                    {section.bullets.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1 text-[var(--accent-primary)]">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="space-y-6 rounded-3xl bg-white/90 p-6 shadow-soft md:p-10">
              <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Отзывы команд</h2>
              <div className="grid gap-6 md:grid-cols-3">
                {TESTIMONIALS.map((card) => (
                  <article key={card.author} className="flex h-full flex-col justify-between rounded-2xl border border-subtle bg-white p-5 text-sm shadow-soft">
                    <p className="mb-4 text-[var(--text-primary)]">“{card.quote}”</p>
                    <div className="flex flex-col text-xs text-muted">
                      <span className="font-semibold text-[var(--text-primary)]">{card.author}</span>
                      <span>{card.role}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="grid gap-6 rounded-3xl bg-white/80 p-6 shadow-soft md:grid-cols-2 md:p-10">
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Free vs Pro</h2>
                <p className="text-sm text-muted">
                  Базовый тариф — это полноценный рабочий инструмент. Профессиональный уровень добавляет аналитику, геймификацию и расширенные интеграции.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-subtle bg-white p-5 shadow-soft">
                  <span className="text-xs font-semibold uppercase tracking-wide text-success">Free</span>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--text-primary)]">
                    {COMPARISON.free.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-success">●</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-subtle bg-white p-5 shadow-soft">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-primary)]">Pro</span>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--text-primary)]">
                    {COMPARISON.pro.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-[var(--accent-primary)]">●</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/pricing"
                    className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-on-primary)] shadow-soft transition-base hover:opacity-90"
                  >
                    Смотреть тарифы
                  </Link>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl bg-white/90 p-6 shadow-soft md:p-10">
              <h2 className="text-2xl font-semibold text-[var(--text-primary)]">FAQ</h2>
              <div className="space-y-4">
                {FAQ_ITEMS.map((item) => (
                  <details key={item.question} className="group rounded-2xl border border-subtle bg-white p-5 shadow-soft">
                    <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">
                      {item.question}
                    </summary>
                    <p className="mt-2 text-sm text-muted">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>

          <aside ref={formRef} className="flex flex-col gap-6 rounded-3xl bg-white/95 p-6 shadow-soft md:sticky md:top-8 md:p-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              <span className="text-[var(--accent-primary)]">{badgeLabel}</span>
              {options?.tagline ? <span>{options.tagline}</span> : null}
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[var(--accent-primary-soft)] px-4 py-2 text-xs text-[var(--accent-primary)]">
              <span>Доступно бесплатно • Без лимита по участникам</span>
            </div>

            <div className="flex rounded-2xl bg-[var(--surface-1)] p-1 text-xs font-semibold text-muted">
              <button
                type="button"
                className={cn(
                  'flex-1 rounded-xl px-4 py-2 transition-base',
                  activeTab !== 'restore' && 'bg-white text-[var(--text-primary)] shadow-soft',
                )}
                onClick={() => switchTab('login')}
              >
                Вход / Регистрация
              </button>
              <button
                type="button"
                className={cn(
                  'flex-1 rounded-xl px-4 py-2 transition-base',
                  activeTab === 'restore' && 'bg-white text-[var(--text-primary)] shadow-soft',
                )}
                onClick={() => switchTab('restore')}
              >
                Магическая ссылка
              </button>
            </div>

            {flash ? (
              <div className="rounded-xl border border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] px-4 py-3 text-xs text-[var(--text-primary)]">
                {flash}
              </div>
            ) : null}
            {magicSuccess ? (
              <div className="rounded-xl border border-[var(--accent-success)] bg-[color-mix(in srgb,var(--accent-success) 12%,white)] px-4 py-3 text-xs text-[var(--text-primary)]">
                {magicSuccess}
              </div>
            ) : null}

            {activeTab === 'restore' ? (
              <form className="space-y-4" onSubmit={handleMagicSubmit}>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-semibold text-[var(--text-primary)]">Email для входа без пароля</span>
                  <input
                    type="email"
                    name="email"
                    required
                    value={magicEmail}
                    onChange={(event) => setMagicEmail(event.target.value)}
                    className="h-12 rounded-xl border border-subtle px-4 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>
                <input type="hidden" name="form_ts" value="0" />
                <input type="hidden" name="hp_url" value="" />
                <button
                  type="submit"
                  disabled={magicMutation.isPending}
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[var(--accent-primary)] text-sm font-semibold text-[var(--accent-on-primary)] shadow-soft transition-base hover:opacity-90 disabled:opacity-60"
                >
                  {magicMutation.isPending ? 'Отправляем…' : 'Получить ссылку на вход'}
                </button>
                <p className="text-xs text-muted">
                  Мы пришлём разовую ссылку. Если email не найден, вы получите подсказку и сможете зарегистрироваться вручную.
                </p>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleLoginSubmit}>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-semibold text-[var(--text-primary)]">Логин или email</span>
                  <input
                    type="text"
                    name="username"
                    required
                    value={loginValues.username}
                    onChange={(event) => {
                      setLoginValues((prev) => ({ ...prev, username: event.target.value }));
                    }}
                    className={cn(
                      'h-12 rounded-xl border border-subtle px-4 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40',
                      errors.username && 'border-[var(--accent-danger)] focus:border-[var(--accent-danger)] focus:ring-[var(--accent-danger)]/30',
                    )}
                    placeholder="Введите логин"
                    autoComplete="username"
                  />
                  {errors.username ? <span className="text-xs text-[var(--accent-danger)]">{errors.username}</span> : null}
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-semibold text-[var(--text-primary)]">Пароль</span>
                  <input
                    type="password"
                    name="password"
                    required
                    value={loginValues.password}
                    onChange={(event) => {
                      setLoginValues((prev) => ({ ...prev, password: event.target.value }));
                    }}
                    className={cn(
                      'h-12 rounded-xl border border-subtle px-4 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40',
                      errors.password && 'border-[var(--accent-danger)] focus:border-[var(--accent-danger)] focus:ring-[var(--accent-danger)]/30',
                    )}
                    placeholder="Введите пароль"
                    autoComplete="current-password"
                  />
                  {errors.password ? <span className="text-xs text-[var(--accent-danger)]">{errors.password}</span> : null}
                </label>
                {options?.recaptcha_site_key ? (
                  <div className="rounded-xl border border-subtle bg-white p-3">
                    <div className="g-recaptcha" data-sitekey={options.recaptcha_site_key} />
                  </div>
                ) : null}
                <input type="hidden" name="next" value={nextValue} />
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[var(--accent-primary)] text-sm font-semibold text-[var(--accent-on-primary)] shadow-soft transition-base hover:opacity-90 disabled:opacity-60"
                >
                  {activeTab === 'signup' ? 'Создать аккаунт' : 'Войти'}
                </button>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                  <button
                    type="button"
                    onClick={handleRemind}
                    className="underline decoration-dotted decoration-[color-mix(in srgb,var(--accent-primary) 60%,transparent)] transition-base hover:text-[var(--accent-primary)]"
                  >
                    Напомнить пароль
                  </button>
                  <button
                    type="button"
                    onClick={() => switchTab('restore')}
                    className="underline decoration-dotted decoration-[color-mix(in srgb,var(--accent-primary) 60%,transparent)] transition-base hover:text-[var(--accent-primary)]"
                  >
                    Войти без пароля
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3 rounded-2xl border border-subtle bg-[var(--surface-1)] p-5 text-sm text-muted">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-primary)]">Другие способы</div>
              <TelegramLoginButton enabled={Boolean(options?.tg_login_enabled)} username={options?.tg_bot_username} />
              <p className="text-xs">
                Нажимая «Войти», вы принимаете{' '}
                <Link href="/docs/privacy" className="underline decoration-dotted">
                  политику конфиденциальности
                </Link>{' '}
                и соглашение о данных. Регистрация автоматически создаёт персональную область и область «Входящие».
              </p>
            </div>

            {configWarnings.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-dashed border-[var(--accent-warning)] bg-[color-mix(in srgb,var(--accent-warning) 12%,white)] p-4 text-xs text-[var(--text-primary)]">
                <span className="font-semibold text-[var(--accent-warning)]">Диагностика конфигурации</span>
                <ul className="space-y-1">
                  {configWarnings.map((warning) => (
                    <li key={warning.code}>
                      <code className="font-mono text-[11px]">{warning.code}</code> — {warning.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </section>
      </main>
    </div>
  );
}
