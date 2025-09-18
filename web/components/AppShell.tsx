'use client';

import clsx from 'clsx';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';

import { apiFetch, ApiError } from '../lib/api';
import { fetchSidebarNav, updateGlobalSidebarLayout, updateUserSidebarLayout } from '../lib/navigation';
import {
  fetchPersonaBundle,
  getPersonaInfo,
  getPreferredLocale,
  DEFAULT_PERSONA_BUNDLE,
  type PersonaBundle,
} from '../lib/persona';
import type {
  SidebarLayoutSettings,
  SidebarNavItem,
  SidebarNavPayload,
  TimeEntry,
  ViewerProfileSummary,
} from '../lib/types';
import { formatClock, formatDateTime, normalizeTimerDescription, parseDateToUtc } from '../lib/time';
import { TimezoneProvider, useTimezone } from '../lib/timezone';
import { Button, Card, StatusIndicator, type StatusIndicatorKind } from './ui';
import { SidebarEditor } from './navigation/SidebarEditor';

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  titleId?: string;
  contentVariant?: 'card' | 'flat';
  maxWidthClassName?: string;
  mainClassName?: string;
}

const NAV_STATUS_TOOLTIPS: Record<StatusIndicatorKind, string> = {
  new: 'Новый раздел на современном интерфейсе',
  wip: 'Раздел в активной разработке — возможны изменения',
  locked: 'Раздел доступен по расширенному тарифу',
};

const COMMUNITY_CHANNEL_URL = 'https://t.me/intDataHELP';
const SUPPORT_CHANNEL_URL = 'https://t.me/HELPintData';
const DEVELOPER_CONTACT_URL = 'https://t.me/leotechru';

const STATIC_NAV_FALLBACK: SidebarNavItem[] = [
  { key: 'overview', label: 'Обзор', href: '/', hidden: false, position: 1, status: { kind: 'new' } },
  { key: 'calendar', label: 'Календарь', href: '/calendar', hidden: false, position: 2, status: { kind: 'new' } },
  { key: 'inbox', label: 'Входящие', href: '/inbox', hidden: false, position: 3 },
  { key: 'tasks', label: 'Задачи', href: '/tasks', hidden: false, position: 4, status: { kind: 'wip' } },
  { key: 'time', label: 'Время', href: '/time', hidden: false, position: 5, status: { kind: 'new' } },
  { key: 'notes', label: 'Заметки', href: '/notes', hidden: false, position: 6, status: { kind: 'new' } },
  { key: 'areas', label: 'Области', href: '/areas', hidden: false, position: 7, status: { kind: 'new' } },
  { key: 'projects', label: 'Проекты', href: '/projects', hidden: false, position: 8, status: { kind: 'new' } },
  { key: 'resources', label: 'Ресурсы', href: '/resources', hidden: false, position: 9, status: { kind: 'wip' } },
  {
    key: 'habits',
    label: 'Привычки',
    href: '/habits',
    hidden: false,
    position: 10,
    status: { kind: 'locked', link: '/tariffs' },
  },
  { key: 'team', label: 'Команда', href: '/users', hidden: false, position: 11, status: { kind: 'new' } },
  { key: 'products', label: 'Продукты', href: '/products', hidden: false, position: 12, status: { kind: 'new' } },
  { key: 'groups', label: 'Группы', href: '/groups', hidden: false, position: 14, status: { kind: 'new' } },
  { key: 'admin', label: 'ЛК Админа', href: '/admin', hidden: true, position: 15, status: { kind: 'new' } },
  { key: 'settings', label: 'Настройки', href: '/settings', hidden: false, position: 16, status: { kind: 'new' } },
];

function getInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) {
    return 'ID';
  }
  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .padEnd(2, '•');
}

function layoutFromItems(version: number, items: SidebarNavItem[]): SidebarLayoutSettings {
  return {
    v: version,
    items: items.map((item, index) => ({
      key: item.key,
      position: index + 1,
      hidden: item.hidden,
    })),
  };
}

function renderPersonaTooltip(md: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(md))) {
    if (match.index > lastIndex) {
      result.push(md.slice(lastIndex, match.index));
    }
    result.push(
      <a
        key={`${match[2]}-${match.index}`}
        href={match[2]}
        target="_blank"
        rel="noreferrer noopener"
        className="text-[var(--accent-primary)] underline decoration-dotted"
      >
        {match[1]}
      </a>,
    );
    lastIndex = linkPattern.lastIndex;
  }

  if (lastIndex < md.length) {
    result.push(md.slice(lastIndex));
  }

  if (result.length === 0) {
    return [md];
  }

  return result;
}

function getTimerElapsedSeconds(entry: TimeEntry, now: number): number {
  let total = entry.active_seconds ?? 0;
  if (entry.is_running && entry.last_started_at) {
    const lastStart = parseDateToUtc(entry.last_started_at)?.getTime() ?? NaN;
    if (!Number.isNaN(lastStart)) {
      total += Math.max(0, Math.floor((now - lastStart) / 1000));
    }
  } else if (entry.end_time && total === 0) {
    const start = parseDateToUtc(entry.start_time)?.getTime() ?? NaN;
    const end = parseDateToUtc(entry.end_time)?.getTime() ?? NaN;
    if (!Number.isNaN(start) && !Number.isNaN(end)) {
      total = Math.max(0, Math.floor((end - start) / 1000));
    }
  } else if (!entry.end_time && !entry.is_running && total === 0) {
    const start = parseDateToUtc(entry.start_time)?.getTime() ?? NaN;
    if (!Number.isNaN(start)) {
      total = Math.max(0, Math.floor((now - start) / 1000));
    }
  }
  return total;
}

export default function AppShell({
  title,
  subtitle,
  actions,
  children,
  titleId,
  contentVariant = 'card',
  maxWidthClassName,
  mainClassName,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isNavEditorOpen, setIsNavEditorOpen] = useState(false);
  const headingId = titleId ?? 'app-shell-title';
  const headingDescriptionId = subtitle ? `${headingId}-description` : undefined;
  const queryClient = useQueryClient();

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mediaQuery.matches);
    const listener = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
      if (event.matches) {
        setIsMobileNavOpen(false);
      }
    };
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setIsHydrated(true);
    const persisted = window.localStorage.getItem('appShell.sidebarCollapsed');
    if (persisted === '1') {
      setIsSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('appShell.sidebarCollapsed', isSidebarCollapsed ? '1' : '0');
  }, [isSidebarCollapsed, isHydrated]);

  const viewerQuery = useQuery<ViewerProfileSummary | null>({
    queryKey: ['viewer-profile-summary'],
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
    queryFn: async () => {
      try {
        return await apiFetch<ViewerProfileSummary>('/api/v1/profiles/users/@me');
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          return null;
        }
        throw error;
      }
    },
  });

  const viewer = viewerQuery.data ?? null;
  const viewerLoading = viewerQuery.isLoading && !viewer;

  const personaQuery = useQuery<PersonaBundle>({
    queryKey: ['persona-bundle'],
    enabled: Boolean(viewer),
    staleTime: 3_600_000,
    gcTime: 3_600_000,
    retry: false,
    queryFn: () => fetchPersonaBundle(getPreferredLocale()),
  });

  const personaBundle = personaQuery.data;

  const navQuery = useQuery<SidebarNavPayload>({
    queryKey: ['navigation', 'sidebar'],
    staleTime: 120_000,
    gcTime: 300_000,
    retry: false,
    queryFn: fetchSidebarNav,
  });

  const toggleLabel = isDesktop
    ? isSidebarCollapsed
      ? 'Показать меню'
      : 'Скрыть меню'
    : isMobileNavOpen
    ? 'Скрыть меню'
    : 'Показать меню';

  const handleToggleNav = () => {
    if (isDesktop) {
      setIsSidebarCollapsed((prev) => !prev);
      return;
    }
    setIsMobileNavOpen((prev) => !prev);
  };

  const navItems = navQuery.data?.items ?? STATIC_NAV_FALLBACK;
  const visibleNavItems = useMemo(() => navItems.filter((item) => !item.hidden), [navItems]);
  const navItemsWithActive = useMemo(
    () =>
      visibleNavItems.map((item) => {
        const href = item.href;
        const active = href && pathname ? pathname === href || pathname.startsWith(`${href}/`) : false;
        return { item, active };
      }),
    [visibleNavItems, pathname],
  );

  const viewerRole = viewer?.role?.toLowerCase() ?? null;
  const hasPaidSupport = Boolean(viewer) && viewerRole !== 'single' && viewerRole !== 'suspended';
  const hasDeveloperContact =
    Boolean(viewer) && (viewerRole === 'moderator' || viewerRole === 'admin' || viewerRole === 'superuser');

  const defaultTimezone = useMemo(() => {
    if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    return 'UTC';
  }, []);

  const timezoneQuery = useQuery<string>({
    queryKey: ['user-settings', 'timezone'],
    enabled: Boolean(viewer),
    staleTime: 3_600_000,
    gcTime: 3_600_000,
    retry: false,
    queryFn: async () => {
      try {
        const response = await apiFetch<{ key: string; value?: { name?: string | null } | null }>(
          '/api/v1/user/settings/timezone',
        );
        const candidate = response?.value?.name;
        if (candidate && candidate.length > 0) {
          return candidate;
        }
      } catch (error) {
        console.warn('Failed to fetch timezone setting', error);
      }
      return defaultTimezone;
    },
  });

  const timezone = viewer ? timezoneQuery.data ?? defaultTimezone : defaultTimezone;

  const navVersion = navQuery.data?.v ?? 1;
  const userLayout = navQuery.data?.layout?.user ?? layoutFromItems(navVersion, navItems);
  const globalLayout = navQuery.data?.layout?.global ?? null;
  const canEditGlobal = Boolean(navQuery.data?.can_edit_global);

  const handleStatusNavigate = (
    status: SidebarNavItem['status'] | undefined,
    event?: React.MouseEvent<HTMLSpanElement>,
  ) => {
    if (!status?.link) {
      return;
    }
    const link = status.link;
    event?.preventDefault();
    event?.stopPropagation();
    router.push(link);
  };

  const saveUserLayoutMutation = useMutation({
    mutationFn: (layout: SidebarLayoutSettings) => updateUserSidebarLayout({ layout }),
    onSuccess: (payload: SidebarNavPayload) => {
      queryClient.setQueryData(['navigation', 'sidebar'], payload);
    },
  });

  const resetUserLayoutMutation = useMutation({
    mutationFn: () => updateUserSidebarLayout({ reset: true }),
    onSuccess: (payload: SidebarNavPayload) => {
      queryClient.setQueryData(['navigation', 'sidebar'], payload);
    },
  });

  const saveGlobalLayoutMutation = useMutation({
    mutationFn: (layout: SidebarLayoutSettings) => updateGlobalSidebarLayout({ layout }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation', 'sidebar'] });
    },
  });

  const resetGlobalLayoutMutation = useMutation({
    mutationFn: () => updateGlobalSidebarLayout({ reset: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation', 'sidebar'] });
    },
  });

  const handleSaveUserLayout = async (layout: SidebarLayoutSettings) => {
    await saveUserLayoutMutation.mutateAsync(layout);
  };
  const handleResetUserLayout = async () => {
    await resetUserLayoutMutation.mutateAsync();
  };
  const handleSaveGlobalLayout = async (layout: SidebarLayoutSettings) => {
    await saveGlobalLayoutMutation.mutateAsync(layout);
  };
  const handleResetGlobalLayout = async () => {
    await resetGlobalLayoutMutation.mutateAsync();
  };

  const userSaving = saveUserLayoutMutation.isPending || resetUserLayoutMutation.isPending;
  const globalSaving = saveGlobalLayoutMutation.isPending || resetGlobalLayoutMutation.isPending;
  const canOpenEditor = Boolean(navQuery.data);

  const sidebarClassName = clsx(
    'fixed inset-y-0 left-0 z-50 w-72 transform border-r border-subtle bg-[var(--surface-0)] px-4 py-6 transition-transform duration-200 ease-out md:static md:px-5 md:py-8',
    isMobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    isSidebarCollapsed
      ? 'md:-translate-x-full md:w-0 md:px-0 md:py-0 md:opacity-0 md:pointer-events-none'
      : 'md:w-64 md:translate-x-0',
  );

  const computedMaxWidth = maxWidthClassName ?? 'max-w-[1400px]';
  const headerClasses = clsx(
    'grid w-full grid-cols-[auto,1fr] grid-rows-[auto,auto] items-center gap-x-3 gap-y-3 px-4 py-4',
    'sm:gap-x-4',
    'md:grid-cols-[auto,1fr,auto] md:grid-rows-1 md:gap-x-4 md:px-6',
  );
  const mainClasses = clsx(
    'relative z-10 flex w-full flex-col gap-6 px-4 py-6 md:px-8 md:py-10',
    contentVariant === 'flat' && 'md:px-10 lg:px-12',
    computedMaxWidth,
    mainClassName,
  );

  return (
    <TimezoneProvider value={timezone}>
      <div className="flex min-h-screen flex-col bg-surface" data-app-shell>
        <header className="sticky top-0 z-40 border-b border-subtle bg-[var(--surface-0)]/95 backdrop-blur">
          <div className={headerClasses}>
            <div className="col-span-1 order-1 flex items-center gap-2 md:order-1 md:gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-soft text-muted transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] md:h-10 md:w-10"
              aria-label={toggleLabel}
              aria-pressed={isDesktop ? !isSidebarCollapsed : isMobileNavOpen}
              onClick={handleToggleNav}
            >
              <span className="sr-only">Меню</span>
              <svg
                aria-hidden
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                {!isDesktop && isMobileNavOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 18h18" />
                  </>
                )}
              </svg>
            </button>
            <Link
              href="/"
              prefetch={false}
              className="group inline-flex items-center gap-2 rounded-full border border-transparent px-2.5 py-1 transition-base hover:border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
              aria-label="Intelligent Data Pro — на главную"
            >
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl shadow-soft">
                <Image
                  src="/static/img/brand/mark.svg"
                  alt="Логотип Intelligent Data Pro"
                  width={28}
                  height={28}
                  className="h-7 w-7"
                  priority
                  unoptimized
                />
              </span>
              <span className="hidden sm:flex flex-col leading-tight">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  Intelligent Data Pro
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">Control Hub</span>
              </span>
            </Link>
          </div>
          <div className="col-span-2 order-3 flex min-w-0 flex-col items-center gap-0.5 text-center md:order-2 md:col-span-1">
            <h1
              id={headingId}
              className="truncate text-lg font-semibold leading-tight text-[var(--text-primary)] md:text-xl"
              title={subtitle ?? undefined}
              aria-describedby={headingDescriptionId}
            >
              {title}
            </h1>
            {subtitle ? (
              <p id={headingDescriptionId} className="sr-only">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="col-span-1 order-2 flex min-w-0 items-center justify-end gap-3 md:order-3 md:flex-nowrap md:justify-self-end">
            {actions ? <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-right md:flex-nowrap">{actions}</div> : null}
            <UserSummary viewer={viewer} isLoading={viewerLoading} personaBundle={personaBundle} />
          </div>
        </div>
      </header>
      <div className="relative flex flex-1">
        <aside
          className={sidebarClassName}
          aria-label="Главное меню"
          aria-hidden={isSidebarCollapsed && !isMobileNavOpen}
        >
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Навигация</span>
              <button
                type="button"
                onClick={() => setIsNavEditorOpen(true)}
                disabled={!canOpenEditor}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-base hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:opacity-50"
                aria-label="Настроить меню"
              >
                <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M6 12h12M10 17h4" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Основное меню">
              {navItemsWithActive.map(({ item, active }) => {
                const baseClass =
                  'flex items-center justify-between rounded-lg px-4 py-2 text-sm font-medium transition-base';
                const interactiveFocus =
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]';
                const stateClass = item.disabled
                  ? 'cursor-not-allowed text-muted opacity-70'
                  : active
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] shadow-soft'
                  : 'text-muted hover:bg-surface-soft hover:text-[var(--text-primary)]';
                const className = `${baseClass} ${stateClass} ${item.disabled ? '' : interactiveFocus}`;
                const status = item.status;
                let statusNode: React.ReactNode = null;
                if (status) {
                  const tooltip = NAV_STATUS_TOOLTIPS[status.kind as StatusIndicatorKind] ?? '';
                  if (status.link) {
                    const link = status.link;
                    statusNode = (
                      <span
                        className="ml-2 inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
                        role="link"
                        tabIndex={0}
                        onClick={(event) => handleStatusNavigate(status, event)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            router.push(link);
                          }
                        }}
                      >
                        <StatusIndicator kind={status.kind as StatusIndicatorKind} tooltip={tooltip} />
                      </span>
                    );
                  } else {
                    statusNode = <StatusIndicator kind={status.kind as StatusIndicatorKind} tooltip={tooltip} />;
                  }
                }
                const content = (
                  <>
                    <span className="truncate">{item.label}</span>
                    {statusNode}
                  </>
                );
                if (item.disabled || !item.href) {
                  return (
                    <span key={item.key} className={className} aria-disabled>
                      {content}
                    </span>
                  );
                }
                if (item.external) {
                  return (
                    <a key={item.key} href={item.href} target="_blank" rel="noreferrer" className={className}>
                      {content}
                    </a>
                  );
                }
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={className}
                    aria-current={active ? 'page' : undefined}
                    prefetch={false}
                  >
                    {content}
                  </Link>
                );
              })}
            </nav>
            {viewer ? (
              <div className="space-y-2 rounded-2xl border border-subtle bg-surface-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Поддержка</p>
                <a
                  href={COMMUNITY_CHANNEL_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--accent-primary)] hover:bg-[color-mix(in srgb, var(--accent-primary) 12%, transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
                >
                  Сообщество
                  <svg aria-hidden className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10v10" />
                  </svg>
                </a>
                {hasPaidSupport ? (
                  <a
                    href={SUPPORT_CHANNEL_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--accent-primary)] hover:bg-[color-mix(in srgb, var(--accent-primary) 12%, transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
                  >
                    Техподдержка
                    <svg aria-hidden className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10v10" />
                    </svg>
                  </a>
                ) : null}
                {hasDeveloperContact ? (
                  <a
                    href={DEVELOPER_CONTACT_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--accent-primary)] hover:bg-[color-mix(in srgb, var(--accent-primary) 12%, transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
                  >
                    Связь с разработчиком
                    <svg aria-hidden className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10v10" />
                    </svg>
                  </a>
                ) : null}
              </div>
            ) : null}
            <MiniTimerWidget viewer={viewer} />
          </div>
        </aside>
        {isMobileNavOpen ? (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            role="presentation"
            onClick={() => setIsMobileNavOpen(false)}
          />
        ) : null}
        <div className="flex min-h-full flex-1 justify-center bg-surface">
          <main className={mainClasses}>
            {contentVariant === 'card' ? (
              <div className="rounded-2xl border border-subtle bg-[var(--surface-0)] p-0 shadow-soft">
                {children}
              </div>
            ) : (
              <div className="w-full" data-app-shell-surface>
                {children}
              </div>
            )}
          </main>
        </div>
      </div>
      <SidebarEditor
        open={isNavEditorOpen}
        version={navVersion}
        items={navItems}
        userLayout={userLayout}
        globalLayout={globalLayout}
        canEditGlobal={canEditGlobal}
        onClose={() => setIsNavEditorOpen(false)}
        onSaveUser={handleSaveUserLayout}
        onResetUser={handleResetUserLayout}
        onSaveGlobal={canEditGlobal ? handleSaveGlobalLayout : undefined}
        onResetGlobal={canEditGlobal ? handleResetGlobalLayout : undefined}
        savingUser={userSaving}
        savingGlobal={globalSaving}
      />
      </div>
    </TimezoneProvider>
  );
}

function MiniTimerWidget({ viewer }: { viewer: ViewerProfileSummary | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const timezone = useTimezone();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const enabled = Boolean(viewer);

  const runningQuery = useQuery<TimeEntry | null, ApiError>({
    queryKey: ['time', 'running'],
    enabled,
    staleTime: 5_000,
    gcTime: 60_000,
    retry: false,
    queryFn: () => apiFetch<TimeEntry | null>('/api/v1/time/running'),
  });

  const startMutation = useMutation({
    mutationFn: () =>
      apiFetch<TimeEntry>('/api/v1/time/start', {
        method: 'POST',
        body: JSON.stringify({ description: null, task_id: null }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time'] });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (entryId: number) =>
      apiFetch<TimeEntry>(`/api/v1/time/${entryId}/pause`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time'] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (entryId: number) =>
      apiFetch<TimeEntry>(`/api/v1/time/${entryId}/resume`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time'] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: (entryId: number) =>
      apiFetch<TimeEntry>(`/api/v1/time/${entryId}/stop`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time'] });
    },
  });

  const activeEntry = runningQuery.data && !runningQuery.data.end_time ? runningQuery.data : null;
  const isRunning = Boolean(activeEntry?.is_running);
  const isPaused = Boolean(activeEntry?.is_paused && !activeEntry?.is_running);
  const elapsedSeconds = activeEntry ? getTimerElapsedSeconds(activeEntry, now) : 0;
  const isLoading =
    runningQuery.isFetching ||
    startMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    stopMutation.isPending;

  const ensureAuth = () => {
    if (viewer) {
      return true;
    }
    router.push('/auth');
    return false;
  };

  const handleStart = () => {
    if (!ensureAuth()) {
      return;
    }
    startMutation.mutate();
  };

  const handlePause = (entry: TimeEntry) => {
    pauseMutation.mutate(entry.id);
  };

  const handleResume = (entry: TimeEntry) => {
    resumeMutation.mutate(entry.id);
  };

  const handleStop = (entry: TimeEntry) => {
    stopMutation.mutate(entry.id);
  };

  const stateTone = isRunning ? 'running' : isPaused ? 'paused' : 'idle';

  const gradientClass = clsx(
    'absolute inset-0 pointer-events-none transition-opacity duration-300',
    stateTone === 'running'
      ? 'bg-gradient-to-br from-emerald-500/18 via-emerald-500/10 to-transparent'
      : stateTone === 'paused'
      ? 'bg-gradient-to-br from-amber-500/18 via-amber-500/10 to-transparent'
      : 'bg-gradient-to-br from-[var(--accent-primary)]/14 via-[var(--accent-primary)]/6 to-transparent',
  );

  const cardClass = 'group relative mt-6 cursor-pointer transition-shadow duration-200 hover:shadow-xl';

  const tooltip = (() => {
    if (!viewer) {
      return 'Авторизуйтесь, чтобы вести учёт времени';
    }
    if (isRunning) {
      return `Таймер запущен с ${formatDateTime(activeEntry?.start_time ?? '', timezone)}`;
    }
    if (isPaused) {
      return `Таймер на паузе с ${formatDateTime(activeEntry?.paused_at ?? activeEntry?.start_time ?? '', timezone)}`;
    }
    return 'Нажмите, чтобы запустить быструю сессию';
  })();
  const description = normalizeTimerDescription(activeEntry?.description);

  const primaryLabel = !viewer
    ? 'Войти'
    : isRunning
      ? 'Пауза'
      : isPaused
      ? 'Продолжить'
      : 'Запустить';

  const primaryIcon = isLoading ? <LoaderIcon /> : isRunning ? <PauseIcon /> : <PlayIcon />;

  const primaryButtonClass = clsx(
    'inline-flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]',
    isRunning
      ? 'bg-emerald-500 hover:bg-emerald-400 focus-visible:ring-emerald-500'
      : isPaused
      ? 'bg-amber-500 hover:bg-amber-400 focus-visible:ring-amber-500'
      : 'bg-[var(--accent-primary)] hover:opacity-90 focus-visible:ring-[var(--accent-primary)]',
    isLoading && 'opacity-70',
  );

  const openDetails = () => router.push('/time');

  const onContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    openDetails();
  };

  const onContainerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDetails();
    }
  };

  const primaryAction = () => {
    if (!viewer) {
      router.push('/auth');
      return;
    }
    if (activeEntry) {
      if (isRunning) {
        handlePause(activeEntry);
      } else if (isPaused) {
        handleResume(activeEntry);
      }
    } else {
      handleStart();
    }
  };

  const liveMessage = isRunning
    ? `Таймер запущен, прошло ${formatClock(elapsedSeconds)}.`
    : isPaused
    ? 'Таймер на паузе.'
    : 'Таймер готов к запуску.';

  return (
    <Card
      as="section"
      data-widget="quick-timer"
      className={cardClass}
      tabIndex={0}
      aria-label="Таймер"
      onClick={onContainerClick}
      onKeyDown={onContainerKeyDown}
      title={tooltip}
    >
      <div className={gradientClass} aria-hidden />
      <div className="relative flex items-start gap-4">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            className={primaryButtonClass}
            onClick={(event) => {
              event.stopPropagation();
              primaryAction();
            }}
            disabled={isLoading}
            title={primaryLabel}
            aria-label={primaryLabel}
          >
            {primaryIcon}
          </button>
          {viewer && activeEntry ? (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-red-600 hover:bg-red-500/10 focus-visible:ring-red-500 dark:text-red-400"
                onClick={(event) => {
                  event.stopPropagation();
                  handleStop(activeEntry);
                }}
                disabled={isLoading || stopMutation.isPending}
                aria-label="Завершить сессию"
                title="Завершить сессию"
              >
                {stopMutation.isPending ? <LoaderIcon /> : <StopIcon />}
              </Button>
              {activeEntry.task_id ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    router.push(`/tasks?task=${activeEntry.task_id}`);
                  }}
                  disabled={isLoading}
                  aria-label={`Открыть задачу #${activeEntry.task_id}`}
                  title={`Открыть задачу #${activeEntry.task_id}`}
                >
                  <TaskIcon />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Таймер</span>
            {activeEntry ? (
              <span className="relative inline-flex h-2.5 w-2.5">
                <span
                  aria-hidden
                  className={clsx(
                    'absolute inset-0 rounded-full transition-colors duration-200',
                    isRunning ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                />
                <span className="sr-only">{isRunning ? 'Таймер активен' : 'Таймер на паузе'}</span>
              </span>
            ) : null}
          </div>
          <div className="mt-2 font-mono text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            {formatClock(elapsedSeconds)}
          </div>
          <p className="mt-1 text-xs text-muted">
            {activeEntry
              ? isRunning
                ? `Запущен ${formatDateTime(activeEntry.start_time, timezone)}`
                : `Пауза с ${formatDateTime(activeEntry.paused_at ?? activeEntry.start_time, timezone)}`
              : 'Таймер готов к запуску'}
          </p>
          {description ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-2">{description}</p>
          ) : null}
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {liveMessage}
      </span>
    </Card>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M7 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="7" y="5" width="3.5" height="14" rx="1.2" fill="currentColor" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}

function TaskIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M9 11l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </svg>
  );
}

function LoaderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
    </svg>
  );
}

function UserSummary({
  viewer,
  isLoading,
  personaBundle,
}: {
  viewer: ViewerProfileSummary | null;
  isLoading: boolean;
  personaBundle?: PersonaBundle;
}) {
  if (isLoading && !viewer) {
    return <div className="h-10 w-10 animate-pulse rounded-full bg-surface-soft" aria-hidden />;
  }
  if (!viewer) {
    return null;
  }
  const displayLabel = viewer.display_name || viewer.username || 'Пользователь';
  const initials = getInitials(displayLabel);
  const persona = getPersonaInfo(personaBundle ?? DEFAULT_PERSONA_BUNDLE, viewer.role);
  const tooltipId = `role-tooltip-${viewer.user_id}`;
  const profileSlug = viewer.profile_slug || viewer.username || '';
  const profileHref = profileSlug ? `/users/${profileSlug}` : '/users';
  const usernameLabel = viewer.username ? `@${viewer.username}` : '—';
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <div className="relative hidden lg:block group/role">
        <div
          tabIndex={0}
          role="button"
          aria-haspopup="true"
          aria-describedby={tooltipId}
          aria-label={`Ваша роль: ${persona.label}`}
          className="inline-flex items-center gap-1 rounded-full border border-subtle px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent-primary)] transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
        >
          {persona.label}
        </div>
        <div
          role="tooltip"
          id={tooltipId}
          className="pointer-events-none absolute left-0 top-full z-40 mt-2 w-max max-w-xs origin-top-left scale-95 rounded-xl border border-subtle bg-[var(--surface-0)] p-3 text-left text-xs text-[var(--text-primary)] opacity-0 shadow-soft transition-all duration-150 ease-out group-hover/role:scale-100 group-hover/role:opacity-100 group-focus-within/role:scale-100 group-focus-within/role:opacity-100"
        >
          <div className="text-sm font-semibold text-[var(--text-primary)]">{persona.label}</div>
          {viewer.headline ? (
            <p className="mt-1 text-xs text-[var(--text-primary)]">{viewer.headline}</p>
          ) : null}
          <p className="mt-1 leading-relaxed text-muted">{renderPersonaTooltip(persona.tooltipMd)}</p>
          {persona.slogan ? (
            <p className="mt-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
              {persona.slogan}
            </p>
          ) : null}
        </div>
      </div>
      <Link
        href={profileHref}
        prefetch={false}
        className="group/link inline-flex items-center gap-2 sm:gap-3 rounded-full border border-transparent px-2 py-1 transition-base hover:border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
        aria-label={`Профиль пользователя ${displayLabel}. Роль: ${persona.label}`}
      >
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-surface-soft text-sm font-semibold text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)]">
          {viewer.avatar_url ? (
            <Image
              src={viewer.avatar_url}
              alt="Аватар пользователя"
              width={40}
              height={40}
              className="h-10 w-10 object-cover"
              unoptimized
            />
          ) : (
            initials
          )}
        </span>
        <span className="hidden sm:flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-medium text-[var(--text-primary)]">{displayLabel}</span>
          <span className="truncate text-xs text-muted">{usernameLabel}</span>
        </span>
        <span className="sr-only">{`Роль: ${persona.label}`}</span>
      </Link>
    </div>
  );
}
