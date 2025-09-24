'use client';

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import React, { memo, useMemo, useState, type CSSProperties } from 'react';

import type { SidebarLayoutMode } from '../../lib/navigation-layout';
import type { SidebarModuleGroup } from '../../lib/navigation-helpers';
import type { SidebarNavItem } from '../../lib/types';
import NavIcon from './NavIcon';

interface SmartSidebarProps {
  moduleGroups: SidebarModuleGroup<SidebarNavItem>[];
  activeModuleId: string;
  onModuleSelect: (moduleId: string) => void;
  onReorderModules: (moduleOrder: string[]) => Promise<void>;
  onReorderModuleItems: (moduleId: string, itemOrder: string[]) => Promise<void>;
  onToggleHidden: (key: string, hidden: boolean) => Promise<void>;
  layoutMode: SidebarLayoutMode;
  onLayoutModeChange?: (mode: SidebarLayoutMode) => void;
  canEditGlobal: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
}

export function SmartSidebar({
  moduleGroups,
  activeModuleId,
  onModuleSelect,
  onReorderModules,
  onReorderModuleItems,
  onToggleHidden,
  layoutMode,
  onLayoutModeChange,
  canEditGlobal,
  isLoading,
  isSaving,
}: SmartSidebarProps) {
  const [openHiddenModule, setOpenHiddenModule] = useState<string | null>(null);

  const moduleOrder = useMemo(() => moduleGroups.map((group) => group.id), [moduleGroups]);

  const itemsByModule = useMemo(() => {
    const map = new Map<string, { visible: SidebarNavItem[]; hidden: SidebarNavItem[] }>();
    moduleGroups.forEach((module) => {
      const visible: SidebarNavItem[] = [];
      const hidden: SidebarNavItem[] = [];
      module.categories.forEach((category) => {
        category.items.forEach((item) => {
          if (item.hidden) {
            hidden.push(item);
          } else {
            visible.push(item);
          }
        });
      });
      map.set(module.id, { visible, hidden });
    });
    return map;
  }, [moduleGroups]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const moduleSortableIds = useMemo(
    () => moduleOrder.map((id) => `module:${id}`),
    [moduleOrder],
  );

  const moduleItemSortableIds = useMemo(() => {
    const entries: Record<string, string[]> = {};
    moduleGroups.forEach((module) => {
      const ids = module.categories
        .flatMap((category) => category.items)
        .filter((item) => !item.hidden)
        .map((item) => `page:${item.key}`);
      entries[module.id] = ids;
    });
    return entries;
  }, [moduleGroups]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const activeType = active.data.current?.type as 'module' | 'page' | undefined;
    if (activeType === 'module') {
      const activeModule = active.data.current?.moduleId as string | undefined;
      const overModule = over.data.current?.moduleId as string | undefined;
      if (!activeModule || !overModule || activeModule === overModule) {
        return;
      }
      const oldIndex = moduleOrder.indexOf(activeModule);
      const newIndex = moduleOrder.indexOf(overModule);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }
      const nextOrder = arrayMove(moduleOrder, oldIndex, newIndex);
      await onReorderModules(nextOrder);
      return;
    }
    if (activeType === 'page') {
      const activeModule = active.data.current?.moduleId as string | undefined;
      const overModule = over.data.current?.moduleId as string | undefined;
      if (!activeModule || !overModule || activeModule !== overModule) {
        return;
      }
      const keys = (itemsByModule.get(activeModule)?.visible ?? []).map((item) => item.key);
      const activeKey = active.data.current?.key as string | undefined;
      const overKey = over.data.current?.key as string | undefined;
      if (!activeKey || !overKey) {
        return;
      }
      const oldIndex = keys.indexOf(activeKey);
      const newIndex = keys.indexOf(overKey);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }
      const nextKeys = arrayMove(keys, oldIndex, newIndex);
      await onReorderModuleItems(activeModule, nextKeys);
    }
  };

  const layoutModeSwitcher = canEditGlobal && onLayoutModeChange ? (
    <div className="flex items-center gap-1 rounded-full bg-white/90 p-1 shadow-sm">
      <ModeSwitchButton
        active={layoutMode === 'user'}
        label="Личные"
        onClick={() => onLayoutModeChange('user')}
      />
      <ModeSwitchButton
        active={layoutMode === 'global'}
        label="Глобальные"
        onClick={() => onLayoutModeChange('global')}
      />
    </div>
  ) : null;

  return (
    <aside
      className="relative flex h-full min-h-screen w-[300px] flex-col border-r border-slate-100 bg-slate-50/80 px-3 py-4 backdrop-blur"
      aria-label="Основная навигация"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-600">Навигация</div>
        {layoutModeSwitcher}
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={moduleSortableIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {moduleGroups.map((module) => (
              <SortableModuleSection
                key={module.id}
                module={module}
                active={module.id === activeModuleId}
                onSelect={onModuleSelect}
                moduleItems={itemsByModule.get(module.id) ?? { visible: [], hidden: [] }}
                sortableIds={moduleItemSortableIds[module.id] ?? []}
                onReorderModuleItems={onReorderModuleItems}
                onToggleHidden={onToggleHidden}
                openHiddenModule={openHiddenModule}
                setOpenHiddenModule={setOpenHiddenModule}
                layoutMode={layoutMode}
                isSaving={isSaving}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="mt-auto pt-4 text-[11px] text-slate-400">
        {layoutMode === 'global'
          ? 'Вы меняете глобальный порядок пунктов. Пользовательские настройки будут поверх.'
          : 'Порядок и видимость сохраняются только для вас.'}
      </div>
      {isLoading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : null}
    </aside>
  );
}

interface SortableModuleSectionProps {
  module: SidebarModuleGroup<SidebarNavItem>;
  active: boolean;
  moduleItems: { visible: SidebarNavItem[]; hidden: SidebarNavItem[] };
  sortableIds: string[];
  onSelect: (moduleId: string) => void;
  onReorderModuleItems: (moduleId: string, keys: string[]) => Promise<void>;
  onToggleHidden: (key: string, hidden: boolean) => Promise<void>;
  openHiddenModule: string | null;
  setOpenHiddenModule: (moduleId: string | null) => void;
  layoutMode: SidebarLayoutMode;
  isSaving?: boolean;
}

const SortableModuleSection = memo(function SortableModuleSection({
  module,
  active,
  moduleItems,
  sortableIds,
  onSelect,
  onReorderModuleItems,
  onToggleHidden,
  openHiddenModule,
  setOpenHiddenModule,
  layoutMode,
  isSaving,
}: SortableModuleSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `module:${module.id}`,
    data: { type: 'module', moduleId: module.id },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const visibleItems = moduleItems.visible;
  const hiddenItems = moduleItems.hidden;
  const hiddenOpen = openHiddenModule === module.id;

  const handleHiddenToggle = () => {
    setOpenHiddenModule(hiddenOpen ? null : module.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'rounded-2xl border border-transparent bg-white/90 p-3 shadow-sm ring-1 ring-transparent transition-all',
        active ? 'ring-blue-200' : 'hover:border-slate-200',
        isDragging && 'shadow-lg opacity-80',
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left"
          onClick={() => onSelect(module.id)}
        >
          <span
            className={clsx(
              'flex h-9 w-9 items-center justify-center rounded-xl text-lg',
              active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500',
            )}
          >
            <NavIcon name={module.icon ?? 'module-generic'} className="h-4 w-4" />
          </span>
          <span>
            <div className="text-sm font-semibold text-slate-800">{module.label}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">
              {module.categories.length} разделов
            </div>
          </span>
        </button>
        <button
          type="button"
          className="cursor-grab rounded-full p-2 text-slate-300 transition-colors hover:text-slate-500"
          aria-label="Перетащить модуль"
          {...attributes}
          {...listeners}
        >
          <DragHandleIcon />
        </button>
      </div>
      <div className="mt-3 space-y-2">
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {visibleItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400">
              Нет видимых страниц
            </div>
          ) : (
            visibleItems.map((item) => (
              <SortablePageItem
                key={item.key}
                item={item}
                moduleId={module.id}
                onToggleHidden={onToggleHidden}
                layoutMode={layoutMode}
                isSaving={isSaving}
              />
            ))
          )}
        </SortableContext>
        <div>
          <button
            type="button"
            onClick={handleHiddenToggle}
            className={clsx(
              'flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm font-medium transition-colors',
              hiddenOpen
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-500 hover:bg-slate-100',
            )}
          >
            <span>Скрытые страницы ({hiddenItems.length})</span>
            <ChevronIcon expanded={hiddenOpen} />
          </button>
          {hiddenOpen && hiddenItems.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {hiddenItems.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => onToggleHidden(item.key, false)}
                    className="flex w-full items-center justify-between rounded-lg bg-slate-100 px-2 py-1.5 text-left text-xs text-slate-500 transition-colors hover:bg-blue-100 hover:text-blue-600"
                    title="Показать страницу"
                    disabled={isSaving}
                  >
                    <span className="truncate">{item.label}</span>
                    <EyeIcon hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
});

interface SortablePageItemProps {
  item: SidebarNavItem;
  moduleId: string;
  onToggleHidden: (key: string, hidden: boolean) => Promise<void>;
  layoutMode: SidebarLayoutMode;
  isSaving?: boolean;
}

const SortablePageItem = memo(function SortablePageItem({
  item,
  moduleId,
  onToggleHidden,
  layoutMode,
  isSaving,
}: SortablePageItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: `page:${item.key}`,
    data: {
      type: 'page',
      moduleId,
      key: item.key,
    },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleHide = () => {
    if (isSaving) {
      return;
    }
    onToggleHidden(item.key, true);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'group flex items-center justify-between gap-2 rounded-xl border border-transparent bg-slate-100 px-3 py-2 transition-colors',
        isDragging ? 'shadow-md' : 'hover:border-blue-200 hover:bg-blue-50',
      )}
    >
      <div className="flex flex-1 items-center gap-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="cursor-grab text-slate-300 transition-colors hover:text-slate-500"
          aria-label="Перетащить страницу"
          {...listeners}
          {...attributes}
        >
          <DragHandleIcon />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-500 shadow-sm">
          <NavIcon name={item.icon ?? 'nav-generic'} className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-700">{item.label}</span>
          {item.status?.kind === 'locked' ? (
            <span className="text-[11px] text-slate-400">Недоступно в текущем тарифе</span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={handleHide}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-blue-100 hover:text-blue-600"
        title={layoutMode === 'global' ? 'Скрыть страницу глобально' : 'Скрыть страницу для себя'}
        disabled={isSaving}
      >
        <EyeIcon />
      </button>
    </div>
  );
});

interface ModeSwitchButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function ModeSwitchButton({ label, active, onClick }: ModeSwitchButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
        active ? 'bg-blue-500 text-white shadow' : 'text-slate-500 hover:bg-slate-100',
      )}
    >
      {label}
    </button>
  );
}

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M10 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM10 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM10 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
    </svg>
  );
}

function EyeIcon({ hidden = false }: { hidden?: boolean }) {
  if (hidden) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12.75 4.5a1.5 1.5 0 0 0-1.5 0l-7.5 4a1.5 1.5 0 0 0 0 2.64l7.5 4a1.5 1.5 0 0 0 1.5 0l7.5-4a1.5 1.5 0 0 0 0-2.64l-7.5-4Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12 5c-5 0-9 4.5-9 7s4 7 9 7 9-4.5 9-7-4-7-9-7Zm0 10.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={clsx('h-4 w-4 transition-transform', expanded ? 'rotate-90 text-blue-500' : 'text-slate-400')}
      fill="currentColor"
      aria-hidden
    >
      <path d="M9 5.5 16.5 12 9 18.5 7.5 17l5-5-5-5Z" />
    </svg>
  );
}
