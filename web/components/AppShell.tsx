'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
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

export default function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

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
      <header className="sticky top-0 z-40 border-b border-subtle bg-[var(--surface-0)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-4 md:px-6">
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
          <div className="flex flex-1 flex-col gap-1">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Intelligent Data Pro</div>
            <div className="text-lg font-semibold leading-tight md:text-xl">{title}</div>
            {subtitle ? <div className="text-sm text-muted">{subtitle}</div> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
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
