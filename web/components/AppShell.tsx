'use client';

import clsx from 'clsx';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';

import { apiFetch, ApiError } from '../lib/api';
import { fetchPersonaBundle, getPersonaInfo, DEFAULT_PERSONA_BUNDLE, type PersonaBundle } from '../lib/persona';
import type { ViewerProfileSummary } from '../lib/types';
import { StatusIndicator, type StatusIndicatorKind } from './ui';

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

interface NavStatus {
  kind: StatusIndicatorKind;
  link?: string;
}

interface NavItem {
  href: string;
  label: string;
  external?: boolean;
  disabled?: boolean;
  status?: NavStatus;
}

type NavBlueprint =
  | { label: string; route: string; status?: NavStatus }
  | { label: string; legacy: string; status?: NavStatus };

const PAYWALL_ROUTE = '/pricing';

const NAV_STATUS_TOOLTIPS: Record<StatusIndicatorKind, string> = {
  new: 'Новый раздел на современном интерфейсе',
  wip: 'Раздел в активной разработке — возможны изменения',
  locked: 'Раздел доступен по расширенному тарифу',
};

const NAV_BLUEPRINT: NavBlueprint[] = [
  { label: 'Обзор', route: '/' },
  { label: 'Входящие', route: '/inbox' },
  { label: 'Области', route: '/areas', status: { kind: 'new' } },
  { label: 'Проекты', route: '/projects', status: { kind: 'new' } },
  { label: 'Команда', route: '/users', status: { kind: 'new' } },
  { label: 'Ресурсы', route: '/resources', status: { kind: 'wip' } },
  { label: 'Задачи', route: '/tasks', status: { kind: 'wip' } },
  { label: 'Привычки', route: '/habits', status: { kind: 'locked', link: PAYWALL_ROUTE } },
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

function resolveNavigation(): NavItem[] {
  const legacyBase = process.env.NEXT_PUBLIC_LEGACY_APP_BASE ?? '';
  return NAV_BLUEPRINT.map<NavItem>((item) => {
    if ('route' in item) {
      return {
        href: item.route,
        label: item.label,
        status: item.status,
      };
    }
    if (legacyBase) {
      return {
        href: `${legacyBase}${item.legacy}`,
        label: item.label,
        status: item.status,
        external: true,
      };
    }
    return {
      href: '#',
      label: item.label,
      status: item.status,
      disabled: true,
    };
  });
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
  const headingId = titleId ?? 'app-shell-title';

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

  const navItems = useMemo(() => {
    const resolved = resolveNavigation();
    const isAdmin = (viewer?.role || '').toLowerCase() === 'admin';
    if (isAdmin && !resolved.some((item) => item.href === '/admin')) {
      resolved.push({ href: '/admin', label: 'ЛК Админа', status: { kind: 'new' } });
    }
    return resolved.map((item) => {
      const active = pathname
        ? !item.external && !item.disabled && (pathname === item.href || pathname.startsWith(`${item.href}/`))
        : false;
      return {
        ...item,
        active,
      };
    });
  }, [pathname, viewer?.role]);

  const handleStatusNavigate = (
    status: NavStatus | undefined,
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

  const sidebarClassName = clsx(
    'fixed inset-y-0 left-0 z-50 w-72 transform border-r border-subtle bg-[var(--surface-0)] px-4 py-6 transition-transform duration-200 ease-out md:static md:px-5 md:py-8',
    isMobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    isSidebarCollapsed
      ? 'md:-translate-x-full md:w-0 md:px-0 md:py-0 md:opacity-0 md:pointer-events-none'
      : 'md:w-64 md:translate-x-0',
  );

  const computedMaxWidth = maxWidthClassName ?? 'max-w-[1400px]';
  const headerClasses = clsx(
    'mx-auto grid w-full grid-cols-[auto,1fr,auto] items-center gap-4 px-4 py-4 md:px-6',
    computedMaxWidth,
  );
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
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary)] shadow-soft">
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
            >
              {title}
            </h1>
            {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
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
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const key = item.label;
              const baseClass =
                'flex items-center justify-between rounded-lg px-4 py-2 text-sm font-medium transition-base';
              const interactiveFocus =
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]';
              const stateClass = item.disabled
                ? 'cursor-not-allowed text-muted opacity-70'
                : item.active
                ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] shadow-soft'
                : 'text-muted hover:bg-surface-soft hover:text-[var(--text-primary)]';
              const className = `${baseClass} ${stateClass} ${item.disabled ? '' : interactiveFocus}`;
              const status = item.status;
              let statusNode: React.ReactNode = null;
              if (status) {
                const tooltip = NAV_STATUS_TOOLTIPS[status.kind];
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
                      <StatusIndicator kind={status.kind} tooltip={tooltip} />
                    </span>
                  );
                } else {
                  statusNode = <StatusIndicator kind={status.kind} tooltip={tooltip} />;
                }
              }
              const content = (
                <>
                  <span className="truncate">{item.label}</span>
                  {statusNode}
                </>
              );
              if (item.disabled) {
                return (
                  <span key={key} className={className} aria-disabled>
                    {content}
                  </span>
                );
              }
              if (item.external) {
                return (
                  <a
                    key={key}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className={className}
                  >
                    {content}
                  </a>
                );
              }
              return (
                <Link
                  key={key}
                  href={item.href}
                  className={className}
                  aria-current={item.active ? 'page' : undefined}
                  prefetch={false}
                >
                  {content}
                </Link>
              );
            })}
          </nav>
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
