import { describe, expect, it } from 'vitest';

import { groupSidebarItemsByModule, sortSidebarItems } from './navigation-helpers';
import type {
  SidebarCategoryDefinition,
  SidebarModuleDefinition,
  SidebarNavItem,
} from './types';

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

  const categories: SidebarCategoryDefinition[] = [
    { id: 'overview', module_id: 'control', label: 'Обзор', order: 100 },
    { id: 'planning', module_id: 'tasks', label: 'Планирование', order: 300 },
    { id: 'resources', module_id: 'tasks', label: 'Ресурсы', order: 320 },
    { id: 'knowledge', module_id: 'knowledge', label: 'Знания', order: 400 },
  ];

  const items: SidebarNavItem[] = [
    {
      key: 'overview',
      label: 'Обзор',
      module: 'control',
      category: 'overview',
      section_order: 100,
      position: 1,
      hidden: false,
    },
    {
      key: 'projects',
      label: 'Проекты',
      module: 'tasks',
      category: 'planning',
      section_order: 310,
      position: 2,
      hidden: false,
    },
    {
      key: 'resources',
      label: 'Ресурсы',
      module: 'tasks',
      category: 'resources',
      section_order: 330,
      position: 4,
      hidden: true,
    },
    {
      key: 'notes',
      label: 'Заметки',
      module: 'knowledge',
      category: 'knowledge',
      section_order: 400,
      position: 3,
      hidden: false,
    },
  ];

  it('groups items by module using provided order', () => {
    const groups = groupSidebarItemsByModule(items, modules, categories);

    expect(groups).toHaveLength(3);
    expect(groups[0].id).toBe('control');
    expect(groups[1].id).toBe('tasks');
    expect(groups[2].id).toBe('knowledge');
  });

  it('sorts items inside modules using section order and position', () => {
    const groups = groupSidebarItemsByModule(items, modules, categories);
    const tasksGroup = groups.find((group) => group.id === 'tasks');
    expect(tasksGroup).toBeDefined();
    const planning = tasksGroup!.categories.find((section) => section.category.id === 'planning');
    expect(planning).toBeDefined();
    expect(planning!.items.map((item) => item.key)).toEqual(['projects']);
    const resourcesSection = tasksGroup!.categories.find((section) => section.category.id === 'resources');
    expect(resourcesSection!.items.map((item) => item.key)).toEqual(['resources']);
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
        category: '',
      },
      {
        key: 'beta',
        label: 'Beta',
        hidden: false,
        position: 1,
        category: undefined,
      },
    ] as unknown as SidebarNavItem[];

    const customModules = [
      { id: '', label: '', order: NaN },
      { id: 'tasks', label: 'Задачи', order: 3000 },
    ] as SidebarModuleDefinition[];

    const groups = groupSidebarItemsByModule(messyItems, customModules, categories);

    expect(groups[0].id).toBe('general');
    const defaultCategory = groups[0].categories.find((section) => section.category.id === 'general');
    expect(defaultCategory?.items.map((item) => item.key)).toEqual(['beta', 'alpha']);
  });
});
