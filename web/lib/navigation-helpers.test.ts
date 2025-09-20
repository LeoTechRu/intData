import { describe, expect, it } from 'vitest';

import { groupSidebarItemsByModule, sortSidebarItems } from './navigation-helpers';
import type { SidebarModuleDefinition, SidebarNavItem } from './types';

describe('sortSidebarItems', () => {
  it('sorts by section_order then position', () => {
    const items = [
      { key: 'b', label: 'B', section_order: 200, position: 3, hidden: false },
      { key: 'a', label: 'A', section_order: 100, position: 2, hidden: false },
      { key: 'c', label: 'C', section_order: 200, position: 1, hidden: false },
      { key: 'd', label: 'D', position: 0, hidden: false },
    ] as SidebarNavItem[];

    const result = sortSidebarItems(items);

    expect(result.map((item) => item.key)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('falls back to label comparison when order and position are equal', () => {
    const items = [
      { key: 'beta', label: 'Бета', position: 1, hidden: false },
      { key: 'alpha', label: 'Альфа', position: 1, hidden: false },
      { key: 'gamma', label: 'Гамма', position: 1, hidden: false },
    ] as SidebarNavItem[];

    const result = sortSidebarItems(items);

    expect(result.map((item) => item.key)).toEqual(['alpha', 'beta', 'gamma']);
  });
});

describe('groupSidebarItemsByModule', () => {
  const modules: SidebarModuleDefinition[] = [
    { id: 'control', label: 'Пульт', order: 1000 },
    { id: 'tasks', label: 'Задачи', order: 3000 },
  ];

  const items: SidebarNavItem[] = [
    { key: 'overview', label: 'Обзор', module: 'control', section_order: 100, position: 1, hidden: false },
    { key: 'projects', label: 'Проекты', module: 'tasks', section_order: 310, position: 2, hidden: false },
    { key: 'resources', label: 'Ресурсы', module: 'tasks', section_order: 330, position: 4, hidden: true },
    { key: 'notes', label: 'Заметки', module: 'knowledge', section_order: 400, position: 3, hidden: false },
  ];

  it('groups items by module using provided order', () => {
    const groups = groupSidebarItemsByModule(items, modules);

    expect(groups).toHaveLength(3);
    expect(groups[0].module.id).toBe('control');
    expect(groups[1].module.id).toBe('tasks');
    expect(groups[2].module.id).toBe('knowledge');
  });

  it('sorts items inside modules using section order and position', () => {
    const groups = groupSidebarItemsByModule(items, modules);
    const tasksGroup = groups.find((group) => group.module.id === 'tasks');
    expect(tasksGroup).toBeDefined();
    expect(tasksGroup!.items.map((item) => item.key)).toEqual(['projects', 'resources']);
  });

  it('skips некорректные записи и нормализует метаданные модулей', () => {
    const messyItems = [
      null,
      undefined,
      {
        key: 'alpha',
        label: 'Alpha',
        hidden: false,
        position: 2,
        module: '',
        section_order: null,
      },
      {
        key: 'beta',
        label: 'Beta',
        hidden: false,
        position: 1,
      },
    ] as unknown as SidebarNavItem[];

    const customModules = [
      { id: '', label: '', order: NaN },
      { id: 'tasks', label: 'Задачи', order: 3000 },
    ] as SidebarModuleDefinition[];

    const groups = groupSidebarItemsByModule(messyItems, customModules);

    expect(groups[0].module.id).toBe('general');
    expect(groups[0].items.map((item) => item.key)).toEqual(['beta', 'alpha']);
  });
});
