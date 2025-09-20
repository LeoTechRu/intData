import type { SidebarModuleDefinition, SidebarNavItem } from './types';

export interface SidebarModuleGroup<T extends { module?: string }> {
  module: SidebarModuleDefinition;
  items: T[];
}

interface SortableNavLike {
  section_order?: number | null;
  position?: number | null;
  label?: string | null;
}

const DEFAULT_MODULE_ORDER = 9000;

export function compareSidebarItems(a: SortableNavLike, b: SortableNavLike): number {
  const orderA = typeof a.section_order === 'number' ? a.section_order : Number.MAX_SAFE_INTEGER;
  const orderB = typeof b.section_order === 'number' ? b.section_order : Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  const positionA = typeof a.position === 'number' ? a.position : Number.MAX_SAFE_INTEGER;
  const positionB = typeof b.position === 'number' ? b.position : Number.MAX_SAFE_INTEGER;
  if (positionA !== positionB) {
    return positionA - positionB;
  }
  const labelA = typeof a.label === 'string' ? a.label : '';
  const labelB = typeof b.label === 'string' ? b.label : '';
  return labelA.localeCompare(labelB, 'ru');
}

export function sortSidebarItems<T extends SortableNavLike>(items: T[]): T[] {
  return [...items].sort(compareSidebarItems);
}

function normalizeModuleDefinition(
  modules: SidebarModuleDefinition[],
  moduleId: string,
): SidebarModuleDefinition {
  const found = modules.find((candidate) => candidate.id === moduleId);
  if (found) {
    const safeId = typeof found.id === 'string' && found.id.trim().length > 0 ? found.id : moduleId;
    return {
      id: safeId,
      label: typeof found.label === 'string' && found.label.length > 0 ? found.label : safeId,
      order: typeof found.order === 'number' ? found.order : DEFAULT_MODULE_ORDER,
    };
  }
  const fallbackId = moduleId.trim().length > 0 ? moduleId : 'general';
  return {
    id: fallbackId,
    label: fallbackId,
    order: DEFAULT_MODULE_ORDER,
  };
}

export function groupSidebarItemsByModule(
  items: SidebarNavItem[],
  modules: SidebarModuleDefinition[],
): SidebarModuleGroup<SidebarNavItem>[] {
  const buckets = new Map<string, SidebarNavItem[]>();
  items.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const moduleIdValue = typeof item.module === 'string' && item.module.trim().length > 0 ? item.module : 'general';
    if (!buckets.has(moduleIdValue)) {
      buckets.set(moduleIdValue, []);
    }
    buckets.get(moduleIdValue)!.push(item);
  });

  const ordered: SidebarModuleGroup<SidebarNavItem>[] = [];
  modules.forEach((module) => {
    const moduleId = typeof module.id === 'string' && module.id.trim().length > 0 ? module.id : 'general';
    const moduleItems = buckets.get(moduleId);
    if (!moduleItems || moduleItems.length === 0) {
      return;
    }
    ordered.push({
      module: normalizeModuleDefinition(modules, moduleId),
      items: sortSidebarItems(moduleItems),
    });
    buckets.delete(moduleId);
  });

  Array.from(buckets.entries())
    .sort(([moduleIdA], [moduleIdB]) => moduleIdA.localeCompare(moduleIdB, 'ru'))
    .forEach(([moduleId, moduleItems]) => {
      ordered.push({
        module: normalizeModuleDefinition(modules, moduleId),
        items: sortSidebarItems(moduleItems),
      });
    });

  return ordered.sort((a, b) => {
    const orderA = typeof a.module.order === 'number' ? a.module.order : DEFAULT_MODULE_ORDER;
    const orderB = typeof b.module.order === 'number' ? b.module.order : DEFAULT_MODULE_ORDER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    const idA = typeof a.module.id === 'string' ? a.module.id : '';
    const idB = typeof b.module.id === 'string' ? b.module.id : '';
    if (idA !== idB) {
      return idA.localeCompare(idB, 'ru');
    }
    return 0;
  });
}
