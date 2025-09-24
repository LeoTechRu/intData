'use client';

import clsx from 'clsx';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';

import { apiFetch, ApiError } from '../lib/api';
import { fetchSidebarNav } from '../lib/navigation';
import { groupSidebarItemsByModule } from '../lib/navigation-helpers';
import {
  ensureLayoutContainsKeys,
  fetchGlobalSidebarLayoutSnapshot,
  fetchUserSidebarLayoutSnapshot,
  reorderModuleItemsLayout,
  reorderModulesLayout,
  saveGlobalSidebarLayout,
  saveUserSidebarLayout,
  setLayoutItemHidden,
  type SidebarLayoutMode,
} from '../lib/navigation-layout';
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
  SidebarLayoutSettings,
  ViewerProfileSummary,
} from '../lib/types';
import { TimezoneProvider } from '../lib/timezone';
import { SmartSidebar } from './navigation/SmartSidebar';
import { ModuleTabsBar } from './navigation/ModuleTabsBar';

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

  const queryClient = useQueryClient();
  const [layoutMode, setLayoutMode] = useState<SidebarLayoutMode>('user');

  const personaQuery = useQuery<PersonaBundle>({
    queryKey: ['persona-bundle'],
    enabled: Boolean(viewer),
    staleTime: 3_600_000,
    gcTime: 3_600_000,
    retry: false,
    queryFn: () => fetchPersonaBundle(getPreferredLocale()),
  });

  const personaBundle = personaQuery.data ?? DEFAULT_PERSONA_BUNDLE;

  const userLayoutQuery = useQuery({
    queryKey: ['navigation', 'layout', 'user'],
    enabled: Boolean(viewer),
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
    queryFn: fetchUserSidebarLayoutSnapshot,
  });

  const canEditGlobalLayout = userLayoutQuery.data?.canEditGlobal ?? false;

  const globalLayoutQuery = useQuery({
    queryKey: ['navigation', 'layout', 'global'],
    enabled: canEditGlobalLayout,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
    queryFn: fetchGlobalSidebarLayoutSnapshot,
  });

  useEffect(() => {
    if (!viewer && layoutMode !== 'user') {
      setLayoutMode('user');
    }
  }, [viewer, layoutMode]);

  useEffect(() => {
    if (!canEditGlobalLayout && layoutMode === 'global') {
      setLayoutMode('user');
    }
  }, [canEditGlobalLayout, layoutMode]);

  const navQuery = useQuery<SidebarNavPayload>({
    queryKey: ['navigation', 'sidebar'],
    staleTime: 120_000,
    gcTime: 300_000,
    retry: false,
    queryFn: fetchSidebarNav,
  });

  const saveUserLayoutMutation = useMutation({
    mutationFn: (input: { layout: SidebarLayoutSettings | null; version: number }) =>
      saveUserSidebarLayout({ payload: input.layout, version: input.version }),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(['navigation', 'layout', 'user'], snapshot);
      queryClient.invalidateQueries({ queryKey: ['navigation', 'sidebar'] });
    },
  });

  const saveGlobalLayoutMutation = useMutation({
    mutationFn: (input: { layout: SidebarLayoutSettings | null; version: number }) =>
      saveGlobalSidebarLayout({ payload: input.layout, version: input.version }),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(['navigation', 'layout', 'global'], snapshot);
      queryClient.invalidateQueries({ queryKey: ['navigation', 'sidebar'] });
      queryClient.invalidateQueries({ queryKey: ['navigation', 'layout', 'user'] });
    },
  });

  const navItems: SidebarNavItem[] = navQuery.data?.items ?? NAV_FALLBACK_ITEMS;

  const navModules: SidebarModuleDefinition[] = useMemo(() => {
    const payload = navQuery.data?.modules;
    if (payload && payload.length > 0) {
      return [...payload].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id, 'ru'));
    }
    return MODULE_FALLBACK;
  }, [navQuery.data?.modules]);

  const canEditPersonalLayout = Boolean(viewer);
  const activeLayoutMode: SidebarLayoutMode = canEditPersonalLayout ? layoutMode : 'user';

  const navCategories = useMemo(() => {
    const payload = navQuery.data?.categories;
    const source = payload && payload.length > 0 ? payload : CATEGORY_FALLBACK;
    return [...source].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id, 'ru'));
  }, [navQuery.data?.categories]);

  const moduleGroups = useMemo(
    () => groupSidebarItemsByModule(navItems, navModules, navCategories),
    [navItems, navModules, navCategories],
  );

  const moduleOrderFromLayout = useMemo(() => {
    const seen: string[] = [];
    [...navItems]
      .sort((a, b) => a.position - b.position)
      .forEach((item) => {
        if (item.module && !seen.includes(item.module)) {
          seen.push(item.module);
        }
      });
    return seen;
  }, [navItems]);

  const orderedModuleGroups = useMemo(() => {
    const orderIndex = new Map<string, number>();
    moduleOrderFromLayout.forEach((id, index) => orderIndex.set(id, index));
    return [...moduleGroups].sort((a, b) => {
      const aIndex = orderIndex.has(a.id) ? orderIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const bIndex = orderIndex.has(b.id) ? orderIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      return a.label.localeCompare(b.label, 'ru');
    });
  }, [moduleGroups, moduleOrderFromLayout]);

  const moduleMap = useMemo(() => new Map(navModules.map((module) => [module.id, module])), [navModules]);

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

  const derivedModuleId = useMemo(() => {
    if (currentNavEntry?.module && moduleMap.has(currentNavEntry.module)) {
      return currentNavEntry.module;
    }
    const firstGroup = orderedModuleGroups[0]?.id;
    if (firstGroup) {
      return firstGroup;
    }
    return navModules[0]?.id ?? 'control';
  }, [currentNavEntry?.module, orderedModuleGroups, navModules, moduleMap]);

  useEffect(() => {
    setActiveModuleId(derivedModuleId);
  }, [derivedModuleId]);

  const moduleDefaultTargets = useMemo(() => {
    const map = new Map<string, string>();
    orderedModuleGroups.forEach((group) => {
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
  }, [orderedModuleGroups]);

  const moduleTabsRaw = useModuleTabs({ moduleId: activeModuleId, moduleGroups: orderedModuleGroups, pathname });
  const moduleTabs = useMemo(
    () => moduleTabsRaw.filter((tab) => !tab.hidden),
    [moduleTabsRaw],
  );

  const getLayoutWithKeys = (): SidebarLayoutSettings =>
    ensureLayoutContainsKeys(
      activeLayoutMode === 'global' ? globalLayoutQuery.data?.layout : userLayoutQuery.data?.layout,
      navItems,
    );

  const submitLayout = async (nextLayout: SidebarLayoutSettings) => {
    if (activeLayoutMode === 'global') {
      if (!canEditGlobalLayout) {
        return;
      }
      const version = globalLayoutQuery.data?.version ?? 0;
      await saveGlobalLayoutMutation.mutateAsync({ layout: nextLayout, version });
    } else {
      if (!canEditPersonalLayout) {
        return;
      }
      const version = userLayoutQuery.data?.version ?? 0;
      await saveUserLayoutMutation.mutateAsync({ layout: nextLayout, version });
    }
  };

  const handleReorderModules = async (order: string[]) => {
    if (!navItems.length) {
      return;
    }
    const baseLayout = getLayoutWithKeys();
    const nextLayout = reorderModulesLayout(baseLayout, navItems, order);
    await submitLayout(nextLayout);
  };

  const handleReorderModuleItems = async (moduleId: string, itemKeys: string[]) => {
    if (!navItems.length) {
      return;
    }
    const baseLayout = getLayoutWithKeys();
    const nextLayout = reorderModuleItemsLayout(baseLayout, navItems, moduleId, itemKeys);
    await submitLayout(nextLayout);
  };

  const handleToggleHiddenItem = async (key: string, hidden: boolean) => {
    const baseLayout = getLayoutWithKeys();
    const nextLayout = setLayoutItemHidden(baseLayout, key, hidden);
    await submitLayout(nextLayout);
  };

  const isSidebarSaving = saveUserLayoutMutation.isPending || saveGlobalLayoutMutation.isPending;
  const isSidebarLoading =
    navQuery.isLoading ||
    (activeLayoutMode === 'global'
      ? globalLayoutQuery.isLoading
      : canEditPersonalLayout && userLayoutQuery.isLoading);

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
    const target = moduleDefaultTargets.get(moduleId);
    if (target && target !== pathname) {
      router.push(target);
    }
  };

  return (
    <TimezoneProvider value={timezone}>
      <div className="flex min-h-screen w-full bg-surface text-[var(--text-primary)]" data-app-shell>
        <SmartSidebar
          moduleGroups={orderedModuleGroups}
          activeModuleId={activeModuleId}
          onModuleSelect={handleModuleSelect}
          onReorderModules={handleReorderModules}
          onReorderModuleItems={handleReorderModuleItems}
          onToggleHidden={handleToggleHiddenItem}
          layoutMode={activeLayoutMode}
          onLayoutModeChange={canEditGlobalLayout ? setLayoutMode : undefined}
          canEditGlobal={canEditGlobalLayout}
          isLoading={isSidebarLoading}
          isSaving={isSidebarSaving}
        />
        <div className="flex min-h-screen flex-1 flex-col bg-white">
          <ModuleTabsBar
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
