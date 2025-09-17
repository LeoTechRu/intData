'use client';

import clsx from 'clsx';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';

import { apiFetch, ApiError } from '../lib/api';
import type { ViewerProfileSummary } from '../lib/types';

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  titleId?: string;
}

interface NavItem {
  href: string;
  label: string;
  badge?: string;
  external?: boolean;
  disabled?: boolean;
}

type NavBlueprint =
  | { label: string; route: string; badge?: string }
  | { label: string; legacy: string; badge?: string };

const NAV_BLUEPRINT: NavBlueprint[] = [
  { label: 'Обзор', route: '/' },
  { label: 'Входящие', route: '/inbox' },
  { label: 'Области', route: '/areas', badge: 'новый UI' },
  { label: 'Проекты', route: '/projects', badge: 'новый UI' },
  { label: 'Команда', route: '/users', badge: 'новый UI' },
  { label: 'Ресурсы', route: '/resources', badge: 'новый UI' },
  { label: 'Задачи', route: '/tasks', badge: 'новый UI' },
  { label: 'Привычки', route: '/habits', badge: 'новый UI' },
];

const ROLE_METADATA: Record<
  string,
  { label: string; title: string; description: string }
> = {
  admin: {
    label: 'Админ',
    title: 'Администратор пространства',
    description:
      'Управляет настройками рабочей области, назначает роли и имеет полный доступ ко всем разделам.',
  },
  single: {
    label: 'Single',
    title: 'Индивидуальный режим',
    description:
      'Работаете с личными проектами и областями. Расширяйте права, чтобы подключать коллег.',
  },
  multiplayer: {
    label: 'Team',
    title: 'Командный режим',
    description:
      'Доступ к совместным проектам и ресурсам. Следите за ролями, чтобы управлять уровнем доступа.',
  },
  moderator: {
    label: 'Модератор',
    title: 'Модератор пространства',
    description:
      'Следит за соблюдением правил, модерирует группы и помогает участникам.',
  },
};

function resolveRoleMetadata(role: string) {
  const normalized = (role ?? '').toLowerCase();
  return (
    ROLE_METADATA[normalized] ?? {
      label: normalized || 'роль',
      title: normalized ? `Роль: ${normalized}` : 'Роль',
      description:
        'Роль определяет доступ к областям и проектам. Уточните у администратора детали доступа.',
    }
  );
}

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
        badge: item.badge,
      };
    }
    if (legacyBase) {
      return {
        href: `${legacyBase}${item.legacy}`,
        label: item.label,
        badge: item.badge ?? 'legacy',
        external: true,
      };
    }
    return {
      href: '#',
      label: item.label,
      badge: item.badge ?? 'legacy',
      disabled: true,
    };
  });
}

export default function AppShell({ title, subtitle, actions, children, titleId }: AppShellProps) {
  const pathname = usePathname();
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
    return resolved.map((item) => {
      const active = pathname
        ? !item.external && !item.disabled && (pathname === item.href || pathname.startsWith(`${item.href}/`))
        : false;
      return {
        ...item,
        active,
      };
    });
  }, [pathname]);

  const sidebarClassName = clsx(
    'fixed inset-y-0 left-0 z-50 w-72 transform border-r border-subtle bg-[var(--surface-0)] px-4 py-6 transition-transform duration-200 ease-out md:static md:px-5 md:py-8',
    isMobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    isSidebarCollapsed
      ? 'md:-translate-x-full md:w-0 md:px-0 md:py-0 md:opacity-0 md:pointer-events-none'
      : 'md:w-64 md:translate-x-0',
  );

  return (
    <div className="flex min-h-screen flex-col bg-surface" data-app-shell>
      <header className="sticky top-0 z-40 border-b border-subtle bg-[var(--surface-0)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-4 md:gap-4 md:px-6">
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
              {isDesktop ? (
                isSidebarCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l6 7-6 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-6 7 6 7" />
                )
              ) : isMobileNavOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
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
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1
              id={headingId}
              className="truncate text-lg font-semibold leading-tight text-[var(--text-primary)] md:text-xl"
            >
              {title}
            </h1>
            {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          <UserSummary viewer={viewer} isLoading={viewerLoading} />
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
              const content = (
                <span className="flex items-center gap-2">
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-[var(--accent-primary-soft)] px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-[var(--text-primary)]">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
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
          <main className="relative z-10 flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
            <div className="rounded-2xl border border-subtle bg-[var(--surface-0)] p-0 shadow-soft">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function UserSummary({
  viewer,
  isLoading,
}: {
  viewer: ViewerProfileSummary | null;
  isLoading: boolean;
}) {
  if (isLoading && !viewer) {
    return <div className="h-10 w-10 animate-pulse rounded-full bg-surface-soft" aria-hidden />;
  }
  if (!viewer) {
    return null;
  }
  const displayLabel = viewer.display_name || viewer.username || 'Пользователь';
  const initials = getInitials(displayLabel);
  const metadata = resolveRoleMetadata(viewer.role);
  const tooltipId = `role-tooltip-${viewer.user_id}`;
  const profileSlug = viewer.profile_slug || viewer.username || '';
  const profileHref = profileSlug ? `/users/${profileSlug}` : '/users';
  const usernameLabel = viewer.username ? `@${viewer.username}` : '—';
  return (
    <div className="flex items-center gap-3">
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
      <div className="relative group/role">
        <div
          tabIndex={0}
          role="button"
          aria-haspopup="true"
          aria-describedby={tooltipId}
          aria-label={`Ваша роль: ${metadata.title}`}
          className="inline-flex items-center gap-1 rounded-full border border-subtle px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent-primary)] transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
        >
          {metadata.label}
        </div>
        <div
          role="tooltip"
          id={tooltipId}
          className="pointer-events-none absolute right-0 top-full z-40 mt-2 w-max max-w-xs origin-top-right scale-95 rounded-xl border border-subtle bg-[var(--surface-0)] p-3 text-left text-xs text-[var(--text-primary)] opacity-0 shadow-soft transition-all duration-150 ease-out group-hover/role:scale-100 group-hover/role:opacity-100 group-focus-within/role:scale-100 group-focus-within/role:opacity-100"
        >
          <div className="text-sm font-semibold text-[var(--text-primary)]">{metadata.title}</div>
          {viewer.headline ? (
            <p className="mt-1 text-xs text-[var(--text-primary)]">{viewer.headline}</p>
          ) : null}
          <p className="mt-1 leading-relaxed text-muted">{metadata.description}</p>
        </div>
      </div>
    </div>
  );
}
