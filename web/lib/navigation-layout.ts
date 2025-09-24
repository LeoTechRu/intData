import { apiFetch } from './api';
import type {
  SidebarCustomLink,
  SidebarLayoutItem,
  SidebarLayoutSettings,
  SidebarNavItem,
} from './types';

export type SidebarLayoutMode = 'user' | 'global';

export interface UserSidebarLayoutSnapshot {
  layout: SidebarLayoutSettings | null;
  version: number;
  hasCustom: boolean;
  merged: SidebarLayoutSettings;
  navVersion: number;
  globalVersion: number;
  globalHasCustom: boolean;
  etag: string;
  globalEtag: string;
  canEditGlobal: boolean;
}

export interface GlobalSidebarLayoutSnapshot {
  layout: SidebarLayoutSettings | null;
  version: number;
  hasCustom: boolean;
  navVersion: number;
  etag: string;
}

interface LayoutMutationPayload {
  payload?: SidebarLayoutSettings | null;
  version?: number | null;
  reset?: boolean;
}

export async function fetchUserSidebarLayoutSnapshot(): Promise<UserSidebarLayoutSnapshot> {
  return apiFetch<UserSidebarLayoutSnapshot>('/api/v1/navigation/user-sidebar-layout');
}

export async function fetchGlobalSidebarLayoutSnapshot(): Promise<GlobalSidebarLayoutSnapshot> {
  return apiFetch<GlobalSidebarLayoutSnapshot>('/api/v1/navigation/global-sidebar-layout');
}

export async function saveUserSidebarLayout(
  payload: LayoutMutationPayload,
): Promise<UserSidebarLayoutSnapshot> {
  return apiFetch<UserSidebarLayoutSnapshot>('/api/v1/navigation/user-sidebar-layout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function saveGlobalSidebarLayout(
  payload: LayoutMutationPayload,
): Promise<GlobalSidebarLayoutSnapshot> {
  return apiFetch<GlobalSidebarLayoutSnapshot>('/api/v1/navigation/global-sidebar-layout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deriveModuleOrder(items: SidebarNavItem[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const sorted = [...items].sort((a, b) => a.position - b.position);
  sorted.forEach((item) => {
    const moduleId = item.module ?? 'general';
    if (!seen.has(moduleId)) {
      seen.add(moduleId);
      order.push(moduleId);
    }
  });
  return order;
}

export function deriveModuleItemKeys(items: SidebarNavItem[]): Record<string, string[]> {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const bucket = new Map<string, string[]>();
  sorted.forEach((item) => {
    const moduleId = item.module ?? 'general';
    if (!bucket.has(moduleId)) {
      bucket.set(moduleId, []);
    }
    bucket.get(moduleId)!.push(item.key);
  });
  return Object.fromEntries(bucket.entries());
}

function cloneCustomLinks(links?: SidebarCustomLink[] | null): SidebarCustomLink[] | undefined {
  if (!links || links.length === 0) {
    return undefined;
  }
  return links.map((link) => ({ ...link }));
}

function cloneLayout(layout: SidebarLayoutSettings | null | undefined): SidebarLayoutSettings {
  if (!layout || !Array.isArray(layout.items)) {
    return {
      v: layout?.v ?? 1,
      items: [],
      primaryModule: layout?.primaryModule ?? null,
      customLinks: cloneCustomLinks(layout?.customLinks),
    };
  }
  return {
    v: layout.v ?? 1,
    items: layout.items.map((item) => ({ ...item })),
    widgets: Array.isArray(layout.widgets) ? layout.widgets.map((item) => ({ ...item })) : undefined,
    primaryModule: layout.primaryModule ?? null,
    customLinks: cloneCustomLinks(layout.customLinks),
  };
}

function rebuildLayoutFromOrder(
  layout: SidebarLayoutSettings,
  orderedKeys: string[],
): SidebarLayoutSettings {
  const map = new Map<string, SidebarLayoutItem>();
  layout.items.forEach((item) => {
    map.set(item.key, { ...item });
  });
  const nextItems: SidebarLayoutItem[] = [];
  let position = 1;
  orderedKeys.forEach((key) => {
    const entry = map.get(key) ?? { key, hidden: false, position };
    nextItems.push({ ...entry, position });
    map.delete(key);
    position += 1;
  });
  if (map.size > 0) {
    for (const entry of map.values()) {
      nextItems.push({ ...entry, position });
      position += 1;
    }
  }
  return {
    ...layout,
    v: layout.v ?? 1,
    items: nextItems,
  };
}

export function reorderModulesLayout(
  layoutSource: SidebarLayoutSettings | null | undefined,
  items: SidebarNavItem[],
  nextModuleOrder: string[],
): SidebarLayoutSettings {
  const layout = cloneLayout(layoutSource);
  const keysByModule = deriveModuleItemKeys(items);
  const orderedKeys: string[] = [];
  const seen = new Set<string>();

  nextModuleOrder.forEach((moduleId) => {
    seen.add(moduleId);
    const keys = keysByModule[moduleId] ?? [];
    orderedKeys.push(...keys);
  });

  Object.entries(keysByModule).forEach(([moduleId, keys]) => {
    if (!seen.has(moduleId)) {
      orderedKeys.push(...keys);
    }
  });

  return rebuildLayoutFromOrder(layout, orderedKeys);
}

export function reorderModuleItemsLayout(
  layoutSource: SidebarLayoutSettings | null | undefined,
  items: SidebarNavItem[],
  moduleId: string,
  nextModuleKeys: string[],
): SidebarLayoutSettings {
  const layout = cloneLayout(layoutSource);
  const keysByModule = deriveModuleItemKeys(items);
  const currentModuleOrder = deriveModuleOrder(items);
  const nextItemsByModule = new Map<string, string[]>();

  currentModuleOrder.forEach((id) => {
    if (id === moduleId) {
      nextItemsByModule.set(id, [...nextModuleKeys]);
    } else {
      nextItemsByModule.set(id, [...(keysByModule[id] ?? [])]);
    }
  });

  const orderedKeys: string[] = [];
  currentModuleOrder.forEach((id) => {
    orderedKeys.push(...(nextItemsByModule.get(id) ?? []));
  });

  Object.entries(keysByModule).forEach(([id, keys]) => {
    if (!nextItemsByModule.has(id)) {
      orderedKeys.push(...keys);
    }
  });

  return rebuildLayoutFromOrder(layout, orderedKeys);
}

export function setLayoutItemHidden(
  layoutSource: SidebarLayoutSettings | null | undefined,
  key: string,
  hidden: boolean,
): SidebarLayoutSettings {
  const layout = cloneLayout(layoutSource);
  const map = new Map<string, SidebarLayoutItem>();
  layout.items.forEach((item) => {
    map.set(item.key, item);
  });
  if (!map.has(key)) {
    const nextPosition = layout.items.length + 1;
    layout.items.push({ key, hidden, position: nextPosition });
    return layout;
  }
  const target = map.get(key)!;
  target.hidden = hidden;
  return layout;
}

export function ensureLayoutContainsKeys(
  layoutSource: SidebarLayoutSettings | null | undefined,
  items: SidebarNavItem[],
): SidebarLayoutSettings {
  const layout = cloneLayout(layoutSource);
  const existingKeys = new Set(layout.items.map((item) => item.key));
  let position = layout.items.length;
  items
    .sort((a, b) => a.position - b.position)
    .forEach((item) => {
      if (!existingKeys.has(item.key)) {
        position += 1;
        layout.items.push({ key: item.key, position, hidden: item.hidden });
      }
    });
  return layout;
}

export function setLayoutPrimaryModule(
  layoutSource: SidebarLayoutSettings | null | undefined,
  moduleId: string,
): SidebarLayoutSettings {
  const layout = cloneLayout(layoutSource);
  layout.primaryModule = moduleId;
  return layout;
}
