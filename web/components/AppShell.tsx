'use client';

import clsx from 'clsx';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiFetch, ApiError } from '../lib/api';
import { fetchSidebarNav, updateGlobalSidebarLayout, updateUserSidebarLayout } from '../lib/navigation';
import { groupSidebarItemsByModule, sortSidebarItems } from '../lib/navigation-helpers';
import {
  fetchPersonaBundle,
  getPersonaInfo,
  getPreferredLocale,
  DEFAULT_PERSONA_BUNDLE,
  type PersonaBundle,
} from '../lib/persona';
import type {
  SidebarLayoutSettings,
  SidebarModuleDefinition,
  SidebarNavItem,
  SidebarNavPayload,
  TimeEntry,
  ViewerProfileSummary,
} from '../lib/types';
import { formatClock, formatDateTime, normalizeTimerDescription, parseDateToUtc } from '../lib/time';
import { TimezoneProvider, useTimezone } from '../lib/timezone';
import { Button, Card, StatusIndicator, type StatusIndicatorKind } from './ui';
import { SidebarEditor } from './navigation/SidebarEditor';
import { ModuleTabs, type ModuleTabItem } from './navigation/ModuleTabs';
import { FavoriteToggle } from './navigation/FavoriteToggle';

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

const STATIC_MODULES: SidebarModuleDefinition[] = [
  { id: 'control', label: 'Пульт', order: 1000 },
  { id: 'calendar', label: 'Календарь', order: 2000 },
  { id: 'tasks', label: 'Задачи', order: 3000 },
  { id: 'knowledge', label: 'Знания', order: 4000 },
  { id: 'team', label: 'Команда', order: 5000 },
  { id: 'admin', label: 'Администрирование', order: 6000 },
];

const STATIC_NAV_FALLBACK: SidebarNavItem[] = [
  {
    key: 'overview',
    label: 'Обзор',
    href: '/',
    hidden: false,
    position: 1,
    status: { kind: 'new' },
    module: 'control',
    section_order: 100,
  },
  {
    key: 'inbox',
    label: 'Входящие',
    href: '/inbox',
    hidden: false,
    position: 2,
    module: 'control',
    section_order: 110,
  },
  {
    key: 'calendar',
    label: 'Календарь',
    href: '/calendar',
    hidden: false,
    position: 3,
    status: { kind: 'new' },
    module: 'calendar',
    section_order: 200,
  },
  {
    key: 'time',
    label: 'Время',
    href: '/time',
    hidden: false,
    position: 4,
    status: { kind: 'new' },
    module: 'calendar',
    section_order: 210,
  },
  {
    key: 'tasks',
    label: 'Задачи',
    href: '/tasks',
    hidden: false,
    position: 5,
    status: { kind: 'wip' },
    module: 'tasks',
    section_order: 300,
  },
  {
    key: 'projects',
    label: 'Проекты',
    href: '/projects',
    hidden: false,
    position: 6,
    status: { kind: 'new' },
    module: 'tasks',
    section_order: 310,
  },
  {
    key: 'areas',
    label: 'Области',
    href: '/areas',
    hidden: false,
    position: 7,
    status: { kind: 'new' },
    module: 'tasks',
    section_order: 320,
  },
  {
    key: 'resources',
    label: 'Ресурсы',
    href: '/resources',
    hidden: false,
    position: 8,
    status: { kind: 'wip' },
    module: 'tasks',
    section_order: 330,
  },
  {
    key: 'notes',
    label: 'Заметки',
    href: '/notes',
    hidden: false,
    position: 9,
    status: { kind: 'new' },
    module: 'knowledge',
    section_order: 400,
  },
  {
    key: 'products',
    label: 'Продукты',
    href: '/products',
    hidden: false,
    position: 10,
    status: { kind: 'new' },
    module: 'knowledge',
    section_order: 410,
  },
  {
    key: 'habits',
    label: 'Привычки',
    href: '/habits',
    hidden: false,
    position: 11,
    status: { kind: 'locked', link: '/tariffs' },
    module: 'team',
    section_order: 500,
  },
  {
    key: 'team',
    label: 'Команда',
    href: '/users',
    hidden: false,
    position: 12,
    status: { kind: 'new' },
    module: 'team',
    section_order: 510,
  },
  {
    key: 'groups',
    label: 'Группы',
    href: '/groups',
    hidden: false,
    position: 13,
    status: { kind: 'new' },
    module: 'team',
    section_order: 520,
  },
  {
    key: 'settings',
    label: 'Настройки',
    href: '/settings',
    hidden: false,
    position: 14,
    status: { kind: 'new' },
    module: 'admin',
    section_order: 600,
  },
  {
    key: 'admin',
    label: 'ЛК Админа',
    href: '/admin',
    hidden: true,
    position: 15,
    status: { kind: 'new' },
    module: 'admin',
    section_order: 610,
  },
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
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  const [expandedHiddenSections, setExpandedHiddenSections] = useState<string[]>([]);
  const sidebarStorageRef = useRef<Storage | null>(null);
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
    try {
      sidebarStorageRef.current = window.localStorage;
    } catch (error) {
      sidebarStorageRef.current = null;
      console.warn('Локальное хранилище меню недоступно, пропускаем восстановление состояния', error);
      return;
    }
    const storage = sidebarStorageRef.current;
    if (!storage) {
      return;
    }
    try {
      const persisted = storage.getItem('appShell.sidebarCollapsed');
      if (persisted === '1') {
        setIsSidebarCollapsed(true);
      }
    } catch (error) {
      console.warn('Не удалось прочитать флаг свернутого меню', error);
    }
    try {
      const collapsedRaw = storage.getItem('appShell.collapsedSections');
      if (collapsedRaw) {
        const parsed = JSON.parse(collapsedRaw);
        if (Array.isArray(parsed)) {
          setCollapsedSections(parsed.filter((entry): entry is string => typeof entry === 'string'));
        }
      }
    } catch (error) {
      console.warn('Не удалось прочитать сохранённые секции меню', error);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const storage = sidebarStorageRef.current;
    if (!storage) {
      return;
    }
    try {
      storage.setItem('appShell.sidebarCollapsed', isSidebarCollapsed ? '1' : '0');
    } catch (error) {
      sidebarStorageRef.current = null;
      console.warn('Не удалось сохранить состояние бокового меню', error);
    }
  }, [isSidebarCollapsed, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const storage = sidebarStorageRef.current;
    if (!storage) {
      return;
    }
    try {
      storage.setItem('appShell.collapsedSections', JSON.stringify(collapsedSections));
    } catch (error) {
      sidebarStorageRef.current = null;
      console.warn('Не удалось сохранить список скрытых секций меню', error);
    }
  }, [collapsedSections, isHydrated]);

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

  const toggleSectionCollapsed = useCallback((moduleId: string) => {
    setCollapsedSections((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId],
    );
  }, []);

  const toggleHiddenSection = useCallback((moduleId: string) => {
    setExpandedHiddenSections((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId],
    );
  }, []);

  const navItems: SidebarNavItem[] = navQuery.data?.items ?? STATIC_NAV_FALLBACK;
  const navModules = useMemo(() => {
    const payload = navQuery.data?.modules;
    const source = payload && payload.length > 0 ? payload : STATIC_MODULES;
    return [...source].sort((a, b) => a.order - b.order);
  }, [navQuery.data?.modules]);
  const moduleMap = useMemo(() => new Map(navModules.map((section) => [section.id, section])), [navModules]);
  const moduleGroups = useMemo(
    () => groupSidebarItemsByModule(navItems, navModules),
    [navItems, navModules],
  );
  const navSections = useMemo(() => {
    return moduleGroups.map((group) => {
      const visible = group.items
        .filter((item) => !item.hidden)
        .map((item) => {
          const href = item.href;
          const active =
            href && pathname ? pathname === href || pathname.startsWith(`${href}/`) : false;
          return { item, active };
        });
      const hidden = group.items.filter((item) => item.hidden);
      return { module: group.module, visible, hidden };
    });
  }, [moduleGroups, pathname]);

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

  const currentNavEntry = useMemo<SidebarNavItem | null>(() => {
    let best: SidebarNavItem | null = null;
    let bestLength = -1;
    navItems.forEach((item) => {
      const href = item.href;
      if (!href) {
        return;
      }
      if (pathname === href || pathname.startsWith(`${href}/`)) {
        const length = href.length;
        if (length > bestLength) {
          best = item;
          bestLength = length;
        }
      }
    });
    return best;
  }, [navItems, pathname]);

  const canToggleFavorite = Boolean(viewer && currentNavEntry);
  const isFavorite = currentNavEntry ? !currentNavEntry.hidden : false;
  const favoriteLabelAdd = currentNavEntry
    ? `Закрепить страницу «${currentNavEntry.label}» в меню`
    : 'Закрепить страницу в меню';
  const favoriteLabelRemove = currentNavEntry
    ? `Убрать страницу «${currentNavEntry.label}» из меню`
    : 'Убрать страницу из меню';

  const moduleTabsData = useMemo(() => {
    const navigable = navItems.filter((item) => item.href && !item.disabled);
    return groupSidebarItemsByModule(navigable, navModules);
  }, [navItems, navModules]);

  const activeModuleId =
    currentNavEntry?.module ??
    moduleTabsData[0]?.module.id ??
    moduleGroups[0]?.module.id ??
    navModules[0]?.id ??
    'general';
  const activeModule =
    moduleMap.get(activeModuleId) ?? { id: activeModuleId, label: activeModuleId, order: 9000 };
  const activeModuleTabs = useMemo<ModuleTabItem[]>(() => {
    const section = moduleTabsData.find((candidate) => candidate.module.id === activeModuleId);
    if (!section) {
      return [];
    }
    return section.items.map((item) => ({
      key: item.key,
      label: item.label,
      href: item.href,
      external: Boolean(item.external),
      hidden: Boolean(item.hidden),
      active: currentNavEntry ? item.key === currentNavEntry.key : false,
    }));
  }, [activeModuleId, currentNavEntry, moduleTabsData]);

  const handleToggleFavorite = async () => {
    if (!currentNavEntry || saveUserLayoutMutation.isPending) {
      return;
    }
    if (!viewer) {
      router.push('/auth');
      return;
    }
    const nextHidden = isFavorite;
    const layout: SidebarLayoutSettings = {
      v: navVersion,
      items: navItems.map((item, index) => ({
        key: item.key,
        position: index + 1,
        hidden: item.key === currentNavEntry.key ? nextHidden : item.hidden,
      })),
    };
    try {
      await handleSaveUserLayout(layout);
    } catch (error) {
      console.error('Failed to toggle favorite', error);
    }
  };

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

  const handleToggleNavItemVisibility = async (target: SidebarNavItem, nextHidden: boolean) => {
    if (userSaving) {
      return;
    }
    if (!viewer) {
      router.push('/auth');
      return;
    }
    const layout: SidebarLayoutSettings = {
      v: navVersion,
      items: navItems.map((item, index) => ({
        key: item.key,
        position: index + 1,
        hidden: item.key === target.key ? nextHidden : item.hidden,
      })),
    };
    try {
      await handleSaveUserLayout(layout);
    } catch (error) {
      console.error('Failed to toggle navigation item visibility', error);
    }
  };

  const moduleTabsBar =
    activeModuleTabs.length > 1 ? (
      <ModuleTabs
        moduleLabel={activeModule.label}
        items={activeModuleTabs}
        className="flex gap-2 overflow-x-auto pb-1"
      />
    ) : null;

  const sidebarClassName = clsx(
    'fixed inset-y-0 left-0 z-50 w-72 transform overflow-y-auto border-r border-subtle bg-[var(--surface-0)] px-4 py-6 transition-transform duration-200 ease-out md:static md:h-full md:overflow-y-auto md:px-5 md:py-8',
    isMobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    isSidebarCollapsed
      ? 'md:-translate-x-full md:w-0 md:px-0 md:py-0 md:opacity-0 md:pointer-events-none'
      : 'md:w-64 md:translate-x-0',
  );

  const computedMaxWidth = maxWidthClassName ?? 'max-w-[1400px]';
  const headerClasses = clsx(
    'grid w-full grid-cols-[auto,minmax(0,1fr),auto] grid-rows-[auto,auto] items-center gap-x-3 gap-y-2 px-3 py-3',
    'sm:px-4 sm:gap-x-4',
    'md:grid-rows-1 md:px-6',
    'lg:py-4',
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
            <div className="col-span-1 order-1 flex items-center gap-2 md:gap-3">
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
          <div className="col-span-1 order-2 flex min-w-0 flex-col items-center gap-0.5 text-center md:col-span-1 md:justify-self-center">
            <div className="flex items-center gap-2">
              <h1
                id={headingId}
                className="truncate text-lg font-semibold leading-tight text-[var(--text-primary)] md:text-xl"
                title={subtitle ?? undefined}
                aria-describedby={headingDescriptionId}
              >
                {title}
              </h1>
              <FavoriteToggle
                active={isFavorite}
                disabled={!canToggleFavorite || saveUserLayoutMutation.isPending}
                onToggle={handleToggleFavorite}
                labelAdd={favoriteLabelAdd}
                labelRemove={favoriteLabelRemove}
              />
            </div>
            {subtitle ? (
              <p id={headingDescriptionId} className="sr-only">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="col-span-3 order-3 flex min-w-0 items-center justify-center gap-3 md:order-3 md:col-span-1 md:flex-nowrap md:justify-self-end md:justify-end">
            {actions ? <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-right md:flex-nowrap">{actions}</div> : null}
            <UserSummary viewer={viewer} isLoading={viewerLoading} personaBundle={personaBundle} />
          </div>
        </div>
      </header>
      <div className="relative flex flex-1 overflow-hidden">
        <aside
          className={sidebarClassName}
          aria-label="Главное меню"
          aria-hidden={isSidebarCollapsed && !isMobileNavOpen}
        >
          <div className="flex min-h-full flex-col gap-4">
            <div className="flex items-center justify-end">
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
            <nav className="flex flex-col gap-3" aria-label="Основное меню">
              {navSections.map(({ module, visible, hidden }) => {
                if (visible.length === 0 && hidden.length === 0) {
                  return null;
                }
                const isCollapsed = collapsedSections.includes(module.id);
                const hiddenOpen = expandedHiddenSections.includes(module.id);
                const hiddenCount = hidden.length;
                return (
                  <section key={module.id} className="flex flex-col gap-2 rounded-2xl border border-transparent px-2 py-1">
                    <button
                      type="button"
                      onClick={() => toggleSectionCollapsed(module.id)}
                      className="flex w-full items-center justify-between rounded-xl px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted transition-base hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                      aria-expanded={!isCollapsed}
                    >
                      <span className="flex items-center gap-2">
                        {module.label}
                        {hiddenCount > 0 ? (
                          <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-semibold text-muted">
                            {hiddenCount}
                          </span>
                        ) : null}
                      </span>
                      <svg
                        aria-hidden
                        className={clsx('h-3.5 w-3.5 transition-transform duration-150', isCollapsed ? '-rotate-90' : 'rotate-0')}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.6}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10l4 4 4-4" />
                      </svg>
                    </button>
                    <div className={clsx('flex flex-col gap-1', isCollapsed && 'hidden')}>
                      {visible.map(({ item, active }) => {
                        const status = item.status;
                        let statusNode: React.ReactNode = null;
                        if (status?.kind) {
                          const statusLink = status.link;
                          const tooltip = statusLink ? NAV_STATUS_TOOLTIPS[status.kind as StatusIndicatorKind] : undefined;
                          if (statusLink) {
                            statusNode = (
                              <span
                                role="button"
                                tabIndex={0}
                                className="ml-2 inline-flex items-center"
                                onClick={(event) => handleStatusNavigate(status, event)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    router.push(statusLink);
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
                        const linkContent = (
                          <>
                            <span className="truncate">{item.label}</span>
                            {statusNode}
                          </>
                        );
                        const baseLinkClass = clsx(
                          'flex flex-1 items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-base',
                          item.disabled
                            ? 'cursor-not-allowed text-muted opacity-70'
                            : active
                            ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] shadow-soft'
                            : 'text-muted hover:bg-surface-soft hover:text-[var(--text-primary)]',
                          !item.disabled &&
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]',
                        );
                        const removeDisabled = item.disabled || userSaving;
                        const removeLabel = `Убрать «${item.label}» из меню`;
                        const linkNode = item.disabled || !item.href ? (
                          <span className={baseLinkClass} aria-disabled>
                            {linkContent}
                          </span>
                        ) : item.external ? (
                          <a href={item.href} target="_blank" rel="noreferrer" className={baseLinkClass}>
                            {linkContent}
                          </a>
                        ) : (
                          <Link
                            href={item.href}
                            className={baseLinkClass}
                            aria-current={active ? 'page' : undefined}
                            prefetch={false}
                          >
                            {linkContent}
                          </Link>
                        );
                        return (
                          <div key={item.key} className="group flex items-center gap-2">
                            {linkNode}
                            <button
                              type="button"
                              onClick={() => handleToggleNavItemVisibility(item, true)}
                              disabled={removeDisabled}
                              className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted transition-base hover:bg-surface-soft hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:opacity-40"
                              aria-label={removeLabel}
                              title={removeLabel}
                            >
                              <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                      {hiddenCount > 0 ? (
                        <div className="mt-2 rounded-xl border border-dashed border-subtle bg-surface-soft/60 p-3">
                          <button
                            type="button"
                            onClick={() => toggleHiddenSection(module.id)}
                            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted transition-base hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                            aria-expanded={hiddenOpen}
                          >
                            <span>Скрытые страницы</span>
                            <svg
                              aria-hidden
                              className={clsx('h-3 w-3 transition-transform duration-150', hiddenOpen ? 'rotate-180' : 'rotate-0')}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.6}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10l4 4 4-4" />
                            </svg>
                          </button>
                          <div className={clsx('mt-2 flex flex-col gap-1', !hiddenOpen && 'hidden')}>
                            {hidden.map((item) => {
                              const addDisabled = userSaving;
                              const addLabel = `Вернуть «${item.label}» в меню`;
                              return (
                                <button
                                  key={item.key}
                                  type="button"
                                  onClick={() => handleToggleNavItemVisibility(item, false)}
                                  disabled={addDisabled}
                                  className="flex items-center justify-between rounded-lg border border-dashed border-subtle bg-[var(--surface-0)] px-3 py-2 text-sm font-medium text-muted transition-base hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:opacity-40"
                                  aria-label={addLabel}
                                  title={addLabel}
                                >
                                  <span className="truncate">{item.label}</span>
                                  <svg
                                    aria-hidden
                                    className="h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={1.6}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                                  </svg>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
          {moduleTabsBar ? (
            <div className="flex justify-center border-b border-subtle/70 bg-[var(--surface-0)]/95 px-3 py-2 sm:px-4 md:px-6" data-module-tabs>
              <div className={clsx('w-full', computedMaxWidth)}>{moduleTabsBar}</div>
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 justify-center overflow-y-auto">
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
      <SidebarEditor
        open={isNavEditorOpen}
        version={navVersion}
        items={navItems}
        modules={navModules}
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
