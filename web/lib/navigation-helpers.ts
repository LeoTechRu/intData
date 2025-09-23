import type {
  SidebarCategoryDefinition,
  SidebarModuleDefinition,
  SidebarNavItem,
} from './types';

export interface SidebarCategoryGroup<T extends { category?: string }> {
  category: SidebarCategoryDefinition;
  items: T[];
}

export interface SidebarModuleGroup<T extends { module?: string; category?: string }>
  extends SidebarModuleDefinition {
  categories: SidebarCategoryGroup<T>[];
}

interface SortableNavLike {
  section_order?: number | null;
  position?: number | null;
  label?: string | null;
}

const DEFAULT_MODULE_ORDER = 9000;
const DEFAULT_CATEGORY_ORDER = 9000;

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

function normalizeCategoryDefinition(
  categories: SidebarCategoryDefinition[],
  moduleId: string,
  categoryId: string,
): SidebarCategoryDefinition {
  const found = categories.find(
    (candidate) => candidate.module_id === moduleId && candidate.id === categoryId,
  );
  if (found) {
    return {
      id: found.id,
      module_id: moduleId,
      label: typeof found.label === 'string' && found.label.length > 0 ? found.label : categoryId,
      order: typeof found.order === 'number' ? found.order : DEFAULT_CATEGORY_ORDER,
    };
  }
  const fallbackId = categoryId.trim().length > 0 ? categoryId : 'general';
  return {
    id: fallbackId,
    module_id: moduleId,
    label: fallbackId,
    order: DEFAULT_CATEGORY_ORDER,
  };
}

export function groupSidebarItemsByModule(
  items: SidebarNavItem[],
  modules: SidebarModuleDefinition[],
  categories: SidebarCategoryDefinition[],
): SidebarModuleGroup<SidebarNavItem>[] {
  const moduleBuckets = new Map<string, Map<string, SidebarNavItem[]>>();

  items.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const moduleId = typeof item.module === 'string' && item.module.trim().length > 0 ? item.module : 'general';
    const categoryId =
      typeof item.category === 'string' && item.category.trim().length > 0 ? item.category : 'general';
    if (!moduleBuckets.has(moduleId)) {
      moduleBuckets.set(moduleId, new Map());
    }
    const categoryBucket = moduleBuckets.get(moduleId)!;
    if (!categoryBucket.has(categoryId)) {
      categoryBucket.set(categoryId, []);
    }
    categoryBucket.get(categoryId)!.push(item);
  });

  const categoriesByModule = new Map<string, SidebarCategoryDefinition[]>();
  categories.forEach((category) => {
    const moduleId = category.module_id;
    if (!categoriesByModule.has(moduleId)) {
      categoriesByModule.set(moduleId, []);
    }
    categoriesByModule.get(moduleId)!.push(category);
  });

  const moduleOrder = new Map<string, SidebarModuleDefinition>();
  modules.forEach((module) => {
    const normalized = normalizeModuleDefinition(modules, module.id);
    moduleOrder.set(normalized.id, normalized);
  });

  const moduleGroups: SidebarModuleGroup<SidebarNavItem>[] = [];

  const pushModuleGroup = (moduleId: string, bucket: Map<string, SidebarNavItem[]>) => {
    const normalizedModule = normalizeModuleDefinition(modules, moduleId);
    const categoryDefs = categoriesByModule.get(normalizedModule.id) ?? [];
    const categoryGroups: SidebarCategoryGroup<SidebarNavItem>[] = [];

    const sortedDefEntries = [...categoryDefs].sort((a, b) => a.order - b.order);
    sortedDefEntries.forEach((definition) => {
      const categoryBucket = bucket.get(definition.id);
      if (!categoryBucket || categoryBucket.length === 0) {
        return;
      }
      categoryGroups.push({
        category: normalizeCategoryDefinition(categories, normalizedModule.id, definition.id),
        items: sortSidebarItems(categoryBucket),
      });
      bucket.delete(definition.id);
    });

    Array.from(bucket.entries())
      .sort(([categoryIdA], [categoryIdB]) => categoryIdA.localeCompare(categoryIdB, 'ru'))
      .forEach(([categoryId, categoryItems]) => {
        categoryGroups.push({
          category: normalizeCategoryDefinition(categories, normalizedModule.id, categoryId),
          items: sortSidebarItems(categoryItems),
        });
      });

    if (categoryGroups.length === 0) {
      return;
    }

    moduleGroups.push({
      ...normalizedModule,
      categories: categoryGroups.sort((a, b) => {
        if (a.category.order !== b.category.order) {
          return a.category.order - b.category.order;
        }
        return a.category.id.localeCompare(b.category.id, 'ru');
      }),
    });
  };

  modules.forEach((module) => {
    const moduleId = module.id;
    const bucket = moduleBuckets.get(moduleId);
    if (bucket) {
      pushModuleGroup(moduleId, bucket);
      moduleBuckets.delete(moduleId);
    }
  });

  Array.from(moduleBuckets.entries())
    .sort(([moduleIdA], [moduleIdB]) => moduleIdA.localeCompare(moduleIdB, 'ru'))
    .forEach(([moduleId, bucket]) => {
      pushModuleGroup(moduleId, bucket);
    });

  return moduleGroups.sort((a, b) => {
    const moduleA = moduleOrder.get(a.id) ?? a;
    const moduleB = moduleOrder.get(b.id) ?? b;
    if (moduleA.order !== moduleB.order) {
      return moduleA.order - moduleB.order;
    }
    return moduleA.id.localeCompare(moduleB.id, 'ru');
  });
}
