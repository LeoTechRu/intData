'use client';

import clsx from 'clsx';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';

import { apiFetch, ApiError } from '../lib/api';
import { fetchSidebarNav } from '../lib/navigation';
import { groupSidebarItemsByModule } from '../lib/navigation-helpers';
import { CATEGORY_FALLBACK, MODULE_FALLBACK, NAV_FALLBACK_ITEMS } from '../lib/navigationFallback';
import {
  DEFAULT_PERSONA_BUNDLE,
  fetchPersonaBundle,
  getPreferredLocale,
  type PersonaBundle,
} from '../lib/persona';
import { useModuleTabs } from '../lib/useModuleTabs';
import type {
  SidebarNavItem,
  SidebarNavPayload,
  SidebarModuleDefinition,
  ViewerProfileSummary,
} from '../lib/types';
import { TimezoneProvider } from '../lib/timezone';
import { LeftSidebar } from './navigation/LeftSidebar';
import { TopNavBar } from './navigation/TopNavBar';

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

const BITRIX_MODULE_ORDER = ['control', 'tasks', 'knowledge', 'team', 'admin'];

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
  const router = useRouter();
  const pathname = usePathname();
  const [activeModuleId, setActiveModuleId] = useState<string>('control');
  const [hiddenExpanded, setHiddenExpanded] = useState(false);

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

  const personaBundle = personaQuery.data ?? DEFAULT_PERSONA_BUNDLE;

  const navQuery = useQuery<SidebarNavPayload>({
    queryKey: ['navigation', 'sidebar'],
    staleTime: 120_000,
    gcTime: 300_000,
    retry: false,
    queryFn: fetchSidebarNav,
  });

  const navItems: SidebarNavItem[] = navQuery.data?.items ?? NAV_FALLBACK_ITEMS;

  const navModules: SidebarModuleDefinition[] = useMemo(() => {
    const payload = navQuery.data?.modules;
    const source = payload && payload.length > 0 ? payload : MODULE_FALLBACK;
    const map = new Map<string, SidebarModuleDefinition>();
    source.forEach((module) => {
      if (BITRIX_MODULE_ORDER.includes(module.id)) {
        map.set(module.id, module);
      }
    });
    MODULE_FALLBACK.forEach((module) => {
      if (BITRIX_MODULE_ORDER.includes(module.id) && !map.has(module.id)) {
        map.set(module.id, module);
      }
    });
    return BITRIX_MODULE_ORDER.map((moduleId) => map.get(moduleId)).filter(Boolean) as SidebarModuleDefinition[];
  }, [navQuery.data?.modules]);

  const navCategories = useMemo(() => {
    const payload = navQuery.data?.categories;
    const source = payload && payload.length > 0 ? payload : CATEGORY_FALLBACK;
    return [...source].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id, 'ru'));
  }, [navQuery.data?.categories]);

  const moduleGroups = useMemo(
    () => groupSidebarItemsByModule(navItems, navModules, navCategories),
    [navItems, navModules, navCategories],
  );

  const moduleMap = useMemo(() => new Map(navModules.map((module) => [module.id, module])), [navModules]);

  const currentNavEntry = useMemo(() => {
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

  const derivedModuleId = useMemo(() => {
    if (currentNavEntry?.module && moduleMap.has(currentNavEntry.module)) {
      return currentNavEntry.module;
    }
    const firstGroup = moduleGroups[0]?.id;
    if (firstGroup) {
      return firstGroup;
    }
    return navModules[0]?.id ?? 'control';
  }, [currentNavEntry?.module, moduleGroups, navModules, moduleMap]);

  useEffect(() => {
    setActiveModuleId(derivedModuleId);
    setHiddenExpanded(false);
  }, [derivedModuleId]);

  const moduleDefaultTargets = useMemo(() => {
    const map = new Map<string, string>();
    moduleGroups.forEach((group) => {
      const visible = group.categories
        .flatMap(({ items }) => items)
        .find((item) => item.href && !item.hidden && !item.disabled)?.href;
      const fallback = group.categories
        .flatMap(({ items }) => items)
        .find((item) => item.href && !item.disabled)?.href;
      const target = visible ?? fallback;
      if (target) {
        map.set(group.id, target.startsWith('/') ? target : `/${target}`);
      }
    });
    return map;
  }, [moduleGroups]);

  const moduleTabsRaw = useModuleTabs({ moduleId: activeModuleId, moduleGroups, pathname });
  const moduleTabs = useMemo(
    () => moduleTabsRaw.filter((tab) => !tab.hidden),
    [moduleTabsRaw],
  );

  const activeHiddenItems = useMemo(
    () => {
      const group = moduleGroups.find((candidate) => candidate.id === activeModuleId);
      if (!group) {
        return [];
      }
      const unique = new Map<string, SidebarNavItem>();
      group.categories.forEach(({ items }) => {
        items.forEach((item) => {
          if (item.hidden && !unique.has(item.key)) {
            unique.set(item.key, item);
          }
        });
      });
      return Array.from(unique.values());
    },
    [activeModuleId, moduleGroups],
  );

  const activeModule = moduleMap.get(activeModuleId) ?? moduleMap.get(derivedModuleId) ?? navModules[0];
  const activeModuleLabel = activeModule?.label ?? 'Модуль';

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

  const headingId = titleId ?? 'app-shell-title';
  const headingDescriptionId = subtitle ? `${headingId}-description` : undefined;

  const computedMaxWidth = maxWidthClassName ?? 'max-w-[1400px]';
  const mainClasses = clsx(
    'relative z-10 mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10',
    contentVariant === 'flat' && 'md:px-10 lg:px-12',
    computedMaxWidth,
    mainClassName,
  );

  const handleModuleSelect = (moduleId: string) => {
    setActiveModuleId(moduleId);
    setHiddenExpanded(false);
    const target = moduleDefaultTargets.get(moduleId);
    if (target && target !== pathname) {
      router.push(target);
    }
  };

  const handleToggleHidden = () => {
    setHiddenExpanded((prev) => !prev);
  };

  return (
    <TimezoneProvider value={timezone}>
      <div className="flex min-h-screen w-full bg-surface text-[var(--text-primary)]" data-app-shell>
        <LeftSidebar
          modules={navModules}
          activeModuleId={activeModuleId}
          onModuleSelect={handleModuleSelect}
          hiddenItems={activeHiddenItems.map((item) => ({
            key: item.key,
            label: item.label,
            href: item.href,
            disabled: item.disabled,
          }))}
          hiddenExpanded={hiddenExpanded}
          onToggleHidden={handleToggleHidden}
        />
        <div className="flex min-h-screen flex-1 flex-col bg-white">
          <TopNavBar
            moduleLabel={activeModuleLabel}
            tabs={moduleTabs}
            viewer={viewer}
            viewerLoading={viewerLoading}
            personaBundle={personaBundle}
          />
          <main className={mainClasses} aria-labelledby={headingId} aria-describedby={headingDescriptionId}>
            {(title || subtitle || actions) && (
              <header className="flex flex-col gap-4 border-b border-slate-100 pb-6">
                <div className="flex flex-col gap-1">
                  {title ? (
                    <h1 id={headingId} className="text-2xl font-semibold text-slate-900">
                      {title}
                    </h1>
                  ) : null}
                  {subtitle ? (
                    <p id={headingDescriptionId} className="text-sm text-slate-500">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
              </header>
            )}
            <section className={clsx('flex flex-1 flex-col gap-6', contentVariant === 'card' && 'pb-10')}>
              {children}
            </section>
          </main>
        </div>
      </div>
    </TimezoneProvider>
  );
}
