import { useMemo } from 'react';

import type { ModuleTabItem } from '../components/navigation/ModuleTabs';
import type { SidebarCategoryDefinition, SidebarNavItem } from './types';
import type { SidebarModuleGroup } from './navigation-helpers';

interface UseModuleTabsOptions {
  moduleId?: string | null;
  moduleGroups: SidebarModuleGroup<SidebarNavItem>[];
  pathname: string;
}

function buildFallbackHref(moduleId: string, categoryId: string): string {
  const normalizedModule = moduleId.startsWith('/') ? moduleId.slice(1) : moduleId;
  const normalizedCategory = categoryId.startsWith('/') ? categoryId.slice(1) : categoryId;
  return `/${normalizedModule}/${normalizedCategory}`.replace(/\/{2,}/g, '/');
}

function pickCategoryHref(
  items: SidebarNavItem[],
  moduleId: string,
  category: SidebarCategoryDefinition,
): string {
  const preferredItem = items.find((item) => item.href && !item.hidden && !item.disabled);
  const fallbackItem = items.find((item) => item.href);
  const href = preferredItem?.href ?? fallbackItem?.href ?? buildFallbackHref(moduleId, category.id);
  if (!href) {
    return buildFallbackHref(moduleId, category.id);
  }
  return href.startsWith('/') ? href : `/${href}`;
}

export function useModuleTabs(options: UseModuleTabsOptions): ModuleTabItem[] {
  const { moduleId, moduleGroups, pathname } = options;

  return useMemo(() => {
    if (!Array.isArray(moduleGroups) || moduleGroups.length === 0) {
      return [];
    }

    const targetModuleId = moduleId?.trim().length ? moduleId.trim() : moduleGroups[0]?.id;
    if (!targetModuleId) {
      return [];
    }

    const targetGroup = moduleGroups.find((group) => group.id === targetModuleId) ?? moduleGroups[0];
    if (!targetGroup) {
      return [];
    }

    const tabs: ModuleTabItem[] = [];
    targetGroup.categories.forEach(({ category, items }) => {
      if (!category || !Array.isArray(items) || items.length === 0) {
        return;
      }
      const href = pickCategoryHref(items, targetGroup.id, category);
      const isActive = pathname === href || pathname.startsWith(`${href}/`);
      const key = `${targetGroup.id}-${category.id}`;
      const hidden = items.every((item) => item.hidden);

      tabs.push({
        key,
        label: category.label,
        href,
        active: isActive,
        hidden,
      });
    });

    return tabs.filter((tab, index, self) => self.findIndex((candidate) => candidate.href === tab.href) === index);
  }, [moduleGroups, moduleId, pathname]);
}

export default useModuleTabs;
