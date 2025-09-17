'use client';

import clsx from 'clsx';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';

import { apiFetch, ApiError } from '../lib/api';
import { fetchSidebarNav, updateGlobalSidebarLayout, updateUserSidebarLayout } from '../lib/navigation';
import { fetchPersonaBundle, getPersonaInfo, DEFAULT_PERSONA_BUNDLE, type PersonaBundle } from '../lib/persona';
import type {
  SidebarLayoutSettings,
  SidebarNavItem,
  SidebarNavPayload,
  TimeEntry,
  ViewerProfileSummary,
} from '../lib/types';
import { formatClock, formatDateTime } from '../lib/time';
import { Button, StatusIndicator, type StatusIndicatorKind } from './ui';
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

const STATIC_NAV_FALLBACK: SidebarNavItem[] = [
  { key: 'overview', label: 'Обзор', href: '/', hidden: false, position: 1, status: { kind: 'new' } },
  { key: 'inbox', label: 'Входящие', href: '/inbox', hidden: false, position: 2 },
  { key: 'areas', label: 'Области', href: '/areas', hidden: false, position: 3, status: { kind: 'new' } },
  { key: 'projects', label: 'Проекты', href: '/projects', hidden: false, position: 4, status: { kind: 'new' } },
  { key: 'team', label: 'Команда', href: '/users', hidden: false, position: 5, status: { kind: 'new' } },
  { key: 'resources', label: 'Ресурсы', href: '/resources', hidden: false, position: 6, status: { kind: 'wip' } },
  { key: 'tasks', label: 'Задачи', href: '/tasks', hidden: false, position: 7, status: { kind: 'wip' } },
  {
    key: 'habits',
    label: 'Привычки',
    href: '/habits',
    hidden: false,
    position: 8,
    status: { kind: 'locked', link: '/pricing' },
  },
  { key: 'time', label: 'Время', href: '/time', hidden: false, position: 9, status: { kind: 'new' } },
  { key: 'settings', label: 'Настройки', href: '/settings', hidden: false, position: 10, status: { kind: 'new' } },
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

function getPreferredLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const [language] = navigator.language.split('-');
    return language || 'ru';
  }
  if (typeof document !== 'undefined') {
    const docLang = document.documentElement.lang;
    if (docLang) {
      const [language] = docLang.split('-');
      return language || 'ru';
    }
  }
  return 'ru';
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

function getRunningDurationSeconds(entry: TimeEntry, now: number): number {
  const start = new Date(entry.start_time).getTime();
  const end = entry.end_time ? new Date(entry.end_time).getTime() : now;
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 0;
  }
  return Math.max(0, Math.floor((end - start) / 1000));
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
  const headerClasses = clsx('grid w-full grid-cols-[auto,1fr,auto] items-center gap-4 px-4 py-4 md:px-6');
  const mainClasses = clsx(
    'relative z-10 flex w-full flex-col gap-6 px-4 py-6 md:px-8 md:py-10',
    contentVariant === 'flat' && 'md:px-10 lg:px-12',
    computedMaxWidth,
    mainClassName,
  );

  return (
    <div className="flex min-h-screen flex-col bg-surface" data-app-shell>
      <header className="sticky top-0 z-40 border-b border-subtle bg-[var(--surface-0)]/95 backdrop-blur">
        <div className={headerClasses}>
          <div className="flex items-center gap-2 md:gap-3">
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
          <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
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
          <div className="flex items-center justify-end gap-3">
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
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
  );
}

function MiniTimerWidget({ viewer }: { viewer: ViewerProfileSummary | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());

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
        body: JSON.stringify({ description: 'Быстрый таймер', task_id: null }),
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

  const handleStart = () => {
    if (!viewer) {
      router.push('/auth');
      return;
    }
    startMutation.mutate();
  };

  const handleStop = (entryId: number) => {
    stopMutation.mutate(entryId);
  };

  const running = runningQuery.data ?? null;
  const timerSeconds = running ? getRunningDurationSeconds(running, now) : 0;
  const isLoading = runningQuery.isFetching || startMutation.isPending || stopMutation.isPending;

  return (
    <div className="mt-6 rounded-2xl border border-subtle bg-[var(--surface-0)] p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Быстрый таймер</div>
          <div className="text-sm text-muted">Запускайте фокус прямо из меню</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push('/time')}
        >
          К журналу
        </Button>
      </div>
      {!viewer ? (
        <div className="mt-3 text-sm text-muted">
          Войдите, чтобы запускать таймеры и видеть прогресс.
        </div>
      ) : runningQuery.isError && runningQuery.error instanceof ApiError && runningQuery.error.status >= 500 ? (
        <div className="mt-3 text-sm text-danger">Не удалось загрузить состояние таймера.</div>
      ) : running ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="text-2xl font-semibold text-[var(--text-primary)]">
            {formatClock(timerSeconds)}
          </div>
          <div className="text-xs text-muted">
            Старт {formatDateTime(running.start_time)}
            {running.description ? ` · ${running.description}` : ''}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleStop(running.id)}
              disabled={isLoading}
            >
              Стоп
            </Button>
            {running.task_id ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/tasks?task=${running.task_id}`)}
              >
                Задача #{running.task_id}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <div className="text-xs text-muted">Таймер не запущен</div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={handleStart} disabled={isLoading}>
              {startMutation.isPending ? 'Запускаем…' : 'Стартовать'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => router.push('/time')}
            >
              Открыть /time
            </Button>
          </div>
        </div>
      )}
    </div>
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
    <div className="flex items-center gap-3">
      <div className="relative group/role">
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
        className="group/link inline-flex items-center gap-3 rounded-full border border-transparent px-2 py-1 transition-base hover:border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
        aria-label={`Профиль пользователя ${displayLabel}`}
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
      </Link>
    </div>
  );
}
