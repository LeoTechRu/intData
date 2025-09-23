'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useEffect, useMemo, useState } from 'react';

import { Button, Checkbox, StatusIndicator } from '../ui';
import type {
  SidebarCategoryDefinition,
  SidebarLayoutSettings,
  SidebarModuleDefinition,
  SidebarNavItem,
} from '../../lib/types';
import { sortSidebarItems } from '../../lib/navigation-helpers';
import { Modal } from '../../ui/uikit/Modal';

interface EditableNavItem {
  key: string;
  label: string;
  hidden: boolean;
  statusKind?: string;
  statusLink?: string;
  moduleId?: string;
  categoryId?: string;
  section_order?: number;
  position: number;
}

interface SidebarEditorProps {
  open: boolean;
  version: number;
  items: SidebarNavItem[];
  modules: SidebarModuleDefinition[];
  categories: SidebarCategoryDefinition[];
  userLayout: SidebarLayoutSettings;
  globalLayout?: SidebarLayoutSettings | null;
  canEditGlobal: boolean;
  onClose: () => void;
  onSaveUser: (layout: SidebarLayoutSettings) => Promise<void> | void;
  onResetUser: () => Promise<void> | void;
  onSaveGlobal?: (layout: SidebarLayoutSettings) => Promise<void> | void;
  onResetGlobal?: () => Promise<void> | void;
  savingUser?: boolean;
  savingGlobal?: boolean;
}

type EditorTab = 'personal' | 'global';

function toEditable(
  items: SidebarNavItem[],
  layout: SidebarLayoutSettings | null | undefined,
): EditableNavItem[] {
  const map = new Map(items.map((item) => [item.key, item]));
  const baseSequence = layout?.items?.length
    ? layout.items
    : items.map((item) => ({ key: item.key, hidden: item.hidden, position: item.position }));
  const seen = new Set<string>();
  const normalized: EditableNavItem[] = [];
  baseSequence
    .filter((entry) => typeof entry?.key === 'string' && map.has(entry.key))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .forEach((entry) => {
      if (!entry || typeof entry.key !== 'string') return;
      if (seen.has(entry.key)) return;
      const base = map.get(entry.key)!;
      normalized.push({
        key: entry.key,
        label: base.label,
        hidden: Boolean(entry.hidden ?? base.hidden),
        statusKind: base.status?.kind,
        statusLink: base.status?.link,
        moduleId: base.module,
        categoryId: base.category,
        section_order: base.section_order,
        position: typeof entry.position === 'number' ? entry.position : base.position,
      });
      seen.add(entry.key);
    });
  items.forEach((item) => {
    if (!seen.has(item.key)) {
      normalized.push({
        key: item.key,
        label: item.label,
        hidden: Boolean(item.hidden),
        statusKind: item.status?.kind,
        statusLink: item.status?.link,
        moduleId: item.module,
        categoryId: item.category,
        section_order: item.section_order,
        position: item.position,
      });
    }
  });
  return normalized;
}

function toLayout(version: number, editables: EditableNavItem[]): SidebarLayoutSettings {
  return {
    v: version,
    items: editables.map((item, index) => ({
      key: item.key,
      position: index + 1,
      hidden: item.hidden,
    })),
  };
}

export function SidebarEditor({
  open,
  version,
  items,
  modules,
  categories,
  userLayout,
  globalLayout,
  canEditGlobal,
  onClose,
  onSaveUser,
  onResetUser,
  onSaveGlobal,
  onResetGlobal,
  savingUser = false,
  savingGlobal = false,
}: SidebarEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('personal');
  const [personalDraft, setPersonalDraft] = useState<EditableNavItem[]>([]);
  const [globalDraft, setGlobalDraft] = useState<EditableNavItem[]>([]);

  useEffect(() => {
    if (open) {
      setPersonalDraft(toEditable(items, userLayout));
      if (canEditGlobal) {
        setGlobalDraft(toEditable(items, globalLayout ?? null));
      }
      setActiveTab('personal');
    }
  }, [open, items, userLayout, globalLayout, canEditGlobal]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeDraft = activeTab === 'personal' ? personalDraft : globalDraft;

  const moduleSections = useMemo(() => {
    const moduleBuckets = new Map<string, Map<string, EditableNavItem[]>>();
    activeDraft.forEach((item) => {
      const moduleId = item.moduleId ?? 'general';
      const categoryId = item.categoryId ?? 'general';
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
    categories.forEach((definition) => {
      if (!categoriesByModule.has(definition.module_id)) {
        categoriesByModule.set(definition.module_id, []);
      }
      categoriesByModule.get(definition.module_id)!.push(definition);
    });

    const moduleOrder = new Map<string, SidebarModuleDefinition>();
    modules.forEach((module) => moduleOrder.set(module.id, module));

    const normalizeModule = (moduleId: string): SidebarModuleDefinition => {
      const module = moduleOrder.get(moduleId);
      if (module) {
        return module;
      }
      return { id: moduleId, label: moduleId, order: 9000 };
    };

    const normalizeCategory = (
      moduleId: string,
      categoryId: string,
    ): SidebarCategoryDefinition => {
      const defs = categoriesByModule.get(moduleId) ?? [];
      const match = defs.find((definition) => definition.id === categoryId);
      if (match) {
        return match;
      }
      return { id: categoryId, module_id: moduleId, label: categoryId, order: 9000 };
    };

    const result: Array<{
      module: SidebarModuleDefinition;
      categories: Array<{ category: SidebarCategoryDefinition; items: EditableNavItem[] }>;
    }> = [];

    const pushModule = (moduleId: string, bucket: Map<string, EditableNavItem[]>) => {
      const moduleDef = normalizeModule(moduleId);
      const categoryDefs = [...(categoriesByModule.get(moduleDef.id) ?? [])].sort(
        (a, b) => a.order - b.order || a.id.localeCompare(b.id, 'ru'),
      );
      const categoryGroups: Array<{ category: SidebarCategoryDefinition; items: EditableNavItem[] }> = [];

      categoryDefs.forEach((definition) => {
        const itemsForCategory = bucket.get(definition.id);
        if (itemsForCategory && itemsForCategory.length > 0) {
          categoryGroups.push({
            category: definition,
            items: sortSidebarItems(itemsForCategory),
          });
          bucket.delete(definition.id);
        }
      });

      Array.from(bucket.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'ru'))
        .forEach(([categoryId, itemsForCategory]) => {
          categoryGroups.push({
            category: normalizeCategory(moduleDef.id, categoryId),
            items: sortSidebarItems(itemsForCategory),
          });
        });

      if (categoryGroups.length === 0) {
        return;
      }

      result.push({ module: moduleDef, categories: categoryGroups });
    };

    modules.forEach((module) => {
      const bucket = moduleBuckets.get(module.id);
      if (bucket) {
        pushModule(module.id, bucket);
        moduleBuckets.delete(module.id);
      }
    });

    Array.from(moduleBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'ru'))
      .forEach(([moduleId, bucket]) => {
        pushModule(moduleId, bucket);
      });

    return result.sort((a, b) => {
      if (a.module.order !== b.module.order) {
        return a.module.order - b.module.order;
      }
      return a.module.id.localeCompare(b.module.id, 'ru');
    });
  }, [activeDraft, modules, categories]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const current = activeTab === 'personal' ? personalDraft : globalDraft;
    const oldIndex = current.findIndex((item) => item.key === active.id);
    const newIndex = current.findIndex((item) => item.key === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }
    const reordered = arrayMove(current, oldIndex, newIndex);
    if (activeTab === 'personal') {
      setPersonalDraft(reordered);
    } else {
      setGlobalDraft(reordered);
    }
  };

  const toggleVisibility = (key: string) => {
    const updater = (list: EditableNavItem[]) =>
      list.map((item) => (item.key === key ? { ...item, hidden: !item.hidden } : item));
    if (activeTab === 'personal') {
      setPersonalDraft((prev) => updater(prev));
    } else {
      setGlobalDraft((prev) => updater(prev));
    }
  };

  const saveDisabled = activeTab === 'personal' ? savingUser : savingGlobal;

  const handleSave = async () => {
    const layout = toLayout(version, activeDraft);
    try {
      if (activeTab === 'personal') {
        await onSaveUser(layout);
        onClose();
      } else if (canEditGlobal && onSaveGlobal) {
        await onSaveGlobal(layout);
        onClose();
      }
    } catch (error) {
      console.error('Failed to save navigation layout', error);
    }
  };

  const handleReset = async () => {
    try {
      if (activeTab === 'personal') {
        await onResetUser();
        onClose();
      } else if (canEditGlobal && onResetGlobal) {
        await onResetGlobal();
        onClose();
      }
    } catch (error) {
      console.error('Failed to reset navigation layout', error);
    }
  };

  const tabs = useMemo((): { id: EditorTab; label: string }[] => {
    const base: { id: EditorTab; label: string }[] = [
      { id: 'personal', label: 'Личный порядок' },
    ];
    if (canEditGlobal) {
      base.push({ id: 'global' as const, label: 'Глобальный порядок' });
    }
    return base;
  }, [canEditGlobal]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-3xl rounded-3xl border border-subtle bg-[var(--surface-0)] p-6 shadow-soft">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Редактор меню</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Перетаскивайте пункты мышью или клавиатурой (пробел — захват, стрелки — перемещение). Справа можно
              временно скрывать разделы — за пределами редактора они исчезнут из меню.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-base hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            aria-label="Закрыть редактор меню"
          >
            <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Режим редактирования меню">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`rounded-full px-4 py-1 text-sm font-medium transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)]'
                    : 'bg-surface-soft text-muted hover:text-[var(--text-primary)]'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {activeTab === 'global' ? (
          <p className="mt-3 text-xs text-muted">
            Глобальный порядок применяется для всех пользователей и подменяется их личными настройками только при
            наличии индивидуального кастома.
          </p>
        ) : null}
        <div className="mt-5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={activeDraft.map((item) => item.key)} strategy={verticalListSortingStrategy}>
              <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-2" aria-live="polite">
                {moduleSections.map(({ module, categories }) => (
                  <React.Fragment key={module.id}>
                    <li className="px-2 text-xs font-semibold uppercase tracking-wide text-muted" aria-hidden>
                      {module.label}
                    </li>
                    {categories.map(({ category, items }) => (
                      <React.Fragment key={`${module.id}-${category.id}`}>
                        <li className="pl-4 text-[11px] font-semibold uppercase tracking-wide text-muted" aria-hidden>
                          {category.label}
                        </li>
                        {items.map((item) => (
                          <SortableNavRow key={item.key} item={item} onToggle={toggleVisibility} />
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={saveDisabled}>
            Сбросить по умолчанию
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saveDisabled}>
              Отменить
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saveDisabled}>
              Сохранить
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}

interface SortableNavRowProps {
  item: EditableNavItem;
  onToggle: (key: string) => void;
}

function SortableNavRow({ item, onToggle }: SortableNavRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const visible = !item.hidden;
  const status = item.statusKind;
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-3 rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-sm shadow-sm transition-base ${
        isDragging ? 'shadow-lg ring-2 ring-[var(--accent-primary)]' : ''
      }`}
    >
      <div className="flex flex-1 items-center gap-3">
        <button
          type="button"
          className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted transition-base hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          aria-label={`Переместить «${item.label}»`}
          {...attributes}
          {...listeners}
        >
          <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 4H5v4M15 4h4v4M9 20H5v-4M15 20h4v-4" />
          </svg>
        </button>
        <div className="flex flex-1 flex-col">
          <span className="font-medium text-[var(--text-primary)]">{item.label}</span>
          <span className="text-xs text-muted">{visible ? 'Отображается' : 'Скрыт'}</span>
        </div>
        {status ? <StatusIndicator kind={status as 'new' | 'wip' | 'locked'} /> : null}
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        <Checkbox
          checked={visible}
          onChange={() => onToggle(item.key)}
          aria-label={visible ? `Скрыть «${item.label}»` : `Показать «${item.label}»`}
        />
        {visible ? 'В меню' : 'Скрыто'}
      </label>
    </li>
  );
}
