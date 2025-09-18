'use client';

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, useId } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';

import { apiFetch, ApiError } from '../../lib/api';
import {
  DEFAULT_PERSONA_BUNDLE,
  fetchPersonaBundle,
  getPersonaInfo,
  getPreferredLocale,
  type PersonaBundle,
} from '../../lib/persona';
import type {
  DashboardHabitItem,
  DashboardLayoutSettings,
  DashboardListItem,
  DashboardMetric,
  DashboardOverview,
  DashboardTimelineItem,
} from '../../lib/types';
import { Button, Card, Textarea } from '../ui';

const MODULE_TITLE = 'Обзор workspace';
const MODULE_DESCRIPTION =
  'Мониторьте ключевые показатели, события и команды в едином адаптивном интерфейсе. В любой момент подстройте сетку под свои задачи и сохраните вид.';
const CUSTOMIZE_HINT =
  'Перетаскивайте карточки и скрывайте лишнее — настройки автоматически применяются для вашего профиля.';

const WIDGET_ORDER: WidgetId[] = [
  'profile_card',
  'today',
  'quick_note',
  'focus_week',
  'goals',
  'focused_hours',
  'health',
  'activity',
  'energy',
  'leader_groups',
  'member_groups',
  'group_moderation',
  'owned_projects',
  'member_projects',
  'upcoming_tasks',
  'reminders',
  'next_events',
  'habits',
];

type WidgetId =
  | 'profile_card'
  | 'today'
  | 'quick_note'
  | 'focus_week'
  | 'goals'
  | 'focused_hours'
  | 'health'
  | 'activity'
  | 'energy'
  | 'leader_groups'
  | 'member_groups'
  | 'group_moderation'
  | 'owned_projects'
  | 'member_projects'
  | 'upcoming_tasks'
  | 'reminders'
  | 'next_events'
  | 'habits';

interface DashboardWidgetDefinition {
  id: WidgetId;
  title: string;
  description?: string;
  className: string;
  hideable?: boolean;
}

const WIDGET_DEFINITIONS: DashboardWidgetDefinition[] = [
  {
    id: 'profile_card',
    title: 'Профиль',
    description: 'Основные контакты и роль в рабочей области.',
    className: 'md:col-span-3 xl:col-span-4',
  },
  {
    id: 'today',
    title: 'Сегодня',
    description: 'Лента событий и напоминаний на текущий день.',
    className: 'md:col-span-3 xl:col-span-5',
  },
  {
    id: 'quick_note',
    title: 'Заметки',
    description: 'Быстрый ввод заметки во Входящие.',
    className: 'md:col-span-3 xl:col-span-3',
  },
  {
    id: 'focus_week',
    title: 'Фокус за неделю',
    className: 'md:col-span-3 xl:col-span-3',
  },
  {
    id: 'goals',
    title: 'Достижения',
    className: 'md:col-span-3 xl:col-span-3',
  },
  {
    id: 'focused_hours',
    title: 'Сфокусированные часы',
    className: 'md:col-span-3 xl:col-span-3',
  },
  {
    id: 'health',
    title: 'Здоровье',
    className: 'md:col-span-3 xl:col-span-3',
  },
  {
    id: 'activity',
    title: 'Активность по дням',
    className: 'md:col-span-6 xl:col-span-6',
  },
  {
    id: 'energy',
    title: 'Сон и энергия',
    className: 'md:col-span-6 xl:col-span-6',
  },
  {
    id: 'leader_groups',
    title: 'Руководите группами',
    className: 'md:col-span-3 xl:col-span-3',
  },
  {
    id: 'member_groups',
    title: 'Состоите в группах',
    className: 'md:col-span-3 xl:col-span-3',
  },
  {
    id: 'group_moderation',
    title: 'Модерация групп',
    className: 'md:col-span-6 xl:col-span-6',
  },
  {
    id: 'owned_projects',
    title: 'Ваши проекты',
    className: 'md:col-span-3 xl:col-span-3',
  },
  {
    id: 'member_projects',
    title: 'Участвуете в проектах',
    className: 'md:col-span-3 xl:col-span-3',
  },
  {
    id: 'upcoming_tasks',
    title: 'Предстоящие задачи',
    className: 'md:col-span-3 xl:col-span-3',
  },
  {
    id: 'reminders',
    title: 'Напоминания',
    className: 'md:col-span-3 xl:col-span-3',
  },
  {
    id: 'next_events',
    title: 'Ближайшие события',
    className: 'md:col-span-3 xl:col-span-3',
  },
  {
    id: 'habits',
    title: 'Привычки',
    className: 'md:col-span-6 xl:col-span-6',
  },
];

const WIDGET_INDEX: Record<WidgetId, DashboardWidgetDefinition> = WIDGET_DEFINITIONS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<WidgetId, DashboardWidgetDefinition>,
);

interface LayoutState {
  layout: DashboardLayoutSettings;
  visible: WidgetId[];
  hidden: WidgetId[];
}

function normalizeLayout(raw?: DashboardLayoutSettings | null): LayoutState {
  const layout: DashboardLayoutSettings = {
    v: raw?.v ?? 1,
    widgets: raw?.widgets ? [...raw.widgets] : undefined,
    hidden: raw?.hidden ? [...raw.hidden] : undefined,
    layouts: raw?.layouts,
    columns: raw?.columns,
    gutter: raw?.gutter,
  };
  const hiddenSet = new Set<WidgetId>();
  for (const id of layout.hidden ?? []) {
    if (WIDGET_INDEX[id as WidgetId]) {
      hiddenSet.add(id as WidgetId);
    }
  }
  const orderSource = layout.widgets && layout.widgets.length > 0 ? layout.widgets : WIDGET_ORDER;
  const visible: WidgetId[] = [];
  for (const id of orderSource) {
    if (WIDGET_INDEX[id as WidgetId] && !hiddenSet.has(id as WidgetId)) {
      visible.push(id as WidgetId);
    }
  }
  for (const id of WIDGET_ORDER) {
    if (!visible.includes(id) && !hiddenSet.has(id)) {
      visible.push(id);
    }
  }
  const hidden: WidgetId[] = Array.from(hiddenSet);
  layout.widgets = visible;
  layout.hidden = hidden;
  return { layout, visible, hidden };
}

function mergeLayout(layout: DashboardLayoutSettings, nextVisible: WidgetId[], nextHidden: WidgetId[]): DashboardLayoutSettings {
  return {
    ...layout,
    widgets: [...nextVisible],
    hidden: [...nextHidden],
  };
}

export default function OverviewDashboard() {
  const queryClient = useQueryClient();
  const overviewQuery = useQuery<DashboardOverview>({
    queryKey: ['dashboard', 'overview'],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: () => apiFetch<DashboardOverview>('/api/v1/dashboard/overview'),
  });

  const layoutQuery = useQuery<DashboardLayoutSettings>({
    queryKey: ['dashboard', 'layout'],
    queryFn: async () => {
      const response = await apiFetch<{ key: string; value: DashboardLayoutSettings } | DashboardLayoutSettings>(
        '/api/v1/user/settings/dashboard_layout',
      );
      if (response && typeof response === 'object' && 'value' in response) {
        return response.value;
      }
      return response as DashboardLayoutSettings;
    },
  });

  const [layoutState, setLayoutState] = useState<LayoutState>(() => normalizeLayout());
  const [isEditing, setIsEditing] = useState(false);
  const [quickNoteTick, setQuickNoteTick] = useState(0);

  useEffect(() => {
    if (layoutQuery.data) {
      setLayoutState(normalizeLayout(layoutQuery.data));
    }
  }, [layoutQuery.data]);

  const layoutMutation = useMutation({
    mutationFn: async (next: DashboardLayoutSettings) => {
      await apiFetch('/api/v1/user/settings/dashboard_layout', {
        method: 'PUT',
        body: JSON.stringify({ value: next }),
      });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        console.error('Не удалось сохранить раскладку', error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'layout'] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleSaveLayout = useCallback(
    (nextVisible: WidgetId[], nextHidden: WidgetId[]) => {
      setLayoutState((prev) => {
        const nextLayout = mergeLayout(prev.layout, nextVisible, nextHidden);
        layoutMutation.mutate(nextLayout);
        return { layout: nextLayout, visible: nextVisible, hidden: nextHidden };
      });
    },
    [layoutMutation],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      const current = layoutState.visible;
      const oldIndex = current.indexOf(active.id as WidgetId);
      const newIndex = current.indexOf(over.id as WidgetId);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }
      const reordered = arrayMove(current, oldIndex, newIndex) as WidgetId[];
      handleSaveLayout(reordered, layoutState.hidden);
    },
    [handleSaveLayout, layoutState.hidden, layoutState.visible],
  );

  const handleHideWidget = useCallback(
    (id: WidgetId) => {
      const nextHidden = [...new Set([...layoutState.hidden, id])];
      const nextVisible = layoutState.visible.filter((w) => w !== id);
      handleSaveLayout(nextVisible, nextHidden);
    },
    [handleSaveLayout, layoutState.hidden, layoutState.visible],
  );

  const handleShowWidget = useCallback(
    (id: WidgetId) => {
      if (!WIDGET_INDEX[id]) {
        return;
      }
      const nextHidden = layoutState.hidden.filter((w) => w !== id);
      const alreadyVisible = layoutState.visible.includes(id);
      const nextVisible = alreadyVisible ? layoutState.visible : [...layoutState.visible, id];
      handleSaveLayout(nextVisible, nextHidden);
    },
    [handleSaveLayout, layoutState.hidden, layoutState.visible],
  );

  const handleResetLayout = useCallback(() => {
    handleSaveLayout([...WIDGET_ORDER], []);
  }, [handleSaveLayout]);

  const isLoading = overviewQuery.isLoading || layoutQuery.isLoading;
  const overviewData = overviewQuery.data;
  const saving = layoutMutation.isPending;

  const hiddenWidgets = useMemo(() => layoutState.hidden, [layoutState.hidden]);
  const visibleWidgets = useMemo(() => layoutState.visible, [layoutState.visible]);

  const hasContent = overviewQuery.isSuccess && overviewData;

  return (
    <div className="flex flex-col gap-6 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-subtle bg-[var(--surface-0)] px-6 py-5 shadow-soft">
        <div className="max-w-3xl space-y-2">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Настройка дашборда</h2>
          <p className="text-sm text-muted">{CUSTOMIZE_HINT}</p>
          {saving ? <p className="text-xs text-[var(--accent-primary)]">Сохраняем раскладку…</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setIsEditing((prev) => !prev)}>
            {isEditing ? 'Завершить настройку' : 'Настроить дашборд'}
          </Button>
          {isEditing ? (
            <Button variant="ghost" onClick={handleResetLayout} disabled={saving}>
              Сбросить по умолчанию
            </Button>
          ) : null}
        </div>
      </header>

      {isEditing ? (
        <HiddenWidgetsPalette
          hidden={hiddenWidgets}
          onShow={handleShowWidget}
          allWidgets={WIDGET_ORDER}
        />
      ) : null}

      {isLoading && !hasContent ? (
        <SkeletonGrid />
      ) : null}

      {!isLoading && !overviewData ? (
        <Card className="p-10 text-center">
          <p className="text-muted">Не удалось загрузить данные дашборда. Попробуйте обновить страницу.</p>
        </Card>
      ) : null}

      {overviewData ? (
        <DndContext
          sensors={sensors}
  modifiers={[restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visibleWidgets} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-6 xl:grid-cols-12">
              {visibleWidgets.map((id) => {
                const definition = WIDGET_INDEX[id];
                if (!definition) {
                  return null;
                }
                return (
                  <SortableWidget
                    key={id}
                    id={id}
                    className={definition.className}
                    isEditing={isEditing}
                    title={definition.title}
                    description={definition.description}
                    onHide={handleHideWidget}
                  >
                    {renderWidget({
                      id,
                      title: definition.title,
                      data: overviewData,
                      quickNoteTick,
                      onQuickNoteSaved: () => setQuickNoteTick((prev) => prev + 1),
                    })}
                  </SortableWidget>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-6 xl:grid-cols-12">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="h-48 animate-pulse bg-surface-soft md:col-span-3 xl:col-span-4" />
      ))}
    </div>
  );
}

function HiddenWidgetsPalette({
  hidden,
  allWidgets,
  onShow,
}: {
  hidden: WidgetId[];
  allWidgets: WidgetId[];
  onShow: (id: WidgetId) => void;
}) {
  if (hidden.length === 0) {
    return (
      <Card surface="soft" className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Все виджеты показаны</h2>
          <p className="text-xs text-muted">Вы можете скрывать их в режиме редактирования.</p>
        </div>
      </Card>
    );
  }
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Скрытые виджеты</h2>
        <p className="text-xs text-muted">Верните их на дашборд, когда они снова понадобятся.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {allWidgets
          .filter((id) => hidden.includes(id))
          .map((id) => (
            <Button key={id} variant="outline" size="sm" onClick={() => onShow(id)}>
              {WIDGET_INDEX[id]?.title || id}
            </Button>
          ))}
      </div>
    </Card>
  );
}

interface SortableWidgetProps {
  id: WidgetId;
  className?: string;
  title: string;
  description?: string;
  isEditing: boolean;
  onHide: (id: WidgetId) => void;
  children: React.ReactNode;
}

function SortableWidget({ id, className, title, description, isEditing, onHide, children }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx('relative', className, isDragging && 'z-30')}
      data-widget={id}
    >
      <Card className={clsx('flex h-full flex-col gap-4', isEditing && 'pointer-events-none')}>
        <WidgetHeader title={title} description={description} />
        <div className="flex-1">
          {children}
        </div>
      </Card>
      {isEditing ? (
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-dashed border-[color-mix(in srgb, var(--accent-primary) 45%, transparent)] bg-[color-mix(in srgb, var(--surface-0) 80%, transparent)]/70 backdrop-blur">
          <div className="pointer-events-auto absolute inset-x-3 top-3 flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-0)]/90 px-3 py-1.5 shadow-soft">
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...listeners}
              {...attributes}
              className="flex items-center gap-1 rounded-lg border border-subtle bg-surface-soft px-2 py-1 text-xs font-medium text-muted"
            >
              <svg aria-hidden className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 14h18" />
              </svg>
              Перетащить
            </button>
            <button
              type="button"
              onClick={() => onHide(id)}
              className="rounded-lg border border-transparent px-2 py-1 text-xs font-medium text-[var(--accent-primary)] transition-base hover:border-[var(--accent-primary)] hover:bg-[color-mix(in srgb, var(--accent-primary) 12%, transparent)]"
            >
              Скрыть
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WidgetHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
      {description ? <p className="text-xs text-muted">{description}</p> : null}
    </div>
  );
}

function renderWidget({
  id,
  title,
  data,
  quickNoteTick,
  onQuickNoteSaved,
}: {
  id: WidgetId;
  title: string;
  data: DashboardOverview;
  quickNoteTick: number;
  onQuickNoteSaved: () => void;
}): ReactNode {
  switch (id) {
    case 'profile_card':
      return <ProfileWidget profile={data.profile} />;
    case 'today':
      return <TimelineWidget items={data.timeline} />;
    case 'quick_note':
      return <QuickNoteWidget tick={quickNoteTick} onSuccess={onQuickNoteSaved} />;
    case 'focus_week':
    case 'goals':
    case 'focused_hours':
    case 'health':
      return <MetricWidget metric={data.metrics[id]} fallbackTitle={title} />;
    case 'activity':
    case 'energy':
      return <PlaceholderWidget message="Скоро появится визуализация" />;
    case 'leader_groups':
    case 'member_groups':
    case 'owned_projects':
    case 'member_projects':
    case 'upcoming_tasks':
    case 'reminders':
    case 'next_events':
      return <ListWidget items={data.collections[id] ?? []} emptyMessage="Нет данных" />;
    case 'group_moderation':
      return (
        <ListWidget
          items={data.collections[id] ?? []}
          emptyMessage="Статистика появится после подключения групп"
          renderMeta={(item) =>
            item.meta ? (
              <span className="text-xs text-muted">
                Активны: {item.meta.active}/{item.meta.members} · Без оплаты: {item.meta.unpaid} · Тихие:{' '}
                {item.meta.quiet} · Последняя активность: {item.meta.last_activity}
              </span>
            ) : null
          }
        />
      );
    case 'habits':
      return <HabitsWidget items={data.habits} />;
    default:
      return <PlaceholderWidget message="Виджет находится в разработке" />;
  }
}

function ProfileWidget({ profile }: { profile: DashboardOverview['profile'] }) {
  const personaQuery = useQuery<PersonaBundle>({
    queryKey: ['persona-bundle'],
    enabled: Boolean(profile),
    staleTime: 3_600_000,
    gcTime: 3_600_000,
    retry: false,
    queryFn: () => fetchPersonaBundle(getPreferredLocale()),
  });
  const personaBundle = personaQuery.data ?? DEFAULT_PERSONA_BUNDLE;

  if (!profile) {
    return <SimpleEmptyState message="Свяжите Telegram-аккаунт, чтобы видеть персональные данные." />;
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-subtle bg-surface-soft p-4">
        <div>
          <p className="text-lg font-semibold text-[var(--text-primary)]">{profile.display_name}</p>
          <p className="text-sm text-muted">@{profile.username}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ProfileField label="Email" value={profile.email} href={profile.email ? `mailto:${profile.email}` : undefined} />
          <ProfileField label="Телефон" value={profile.phone} href={profile.phone_href ?? undefined} />
          <ProfileField label="День рождения" value={formatBirthday(profile.birthday)} />
          <ProfileField label="Язык" value={profile.language || 'не указан'} />
        </div>
      </div>
      <ProfileRoleBadge role={profile.role} personaBundle={personaBundle} />
    </div>
  );
}

function ProfileRoleBadge({
  role,
  personaBundle,
}: {
  role?: string | null;
  personaBundle: PersonaBundle;
}) {
  const persona = getPersonaInfo(personaBundle, role);
  const tooltipId = useId();

  return (
    <div className="rounded-xl bg-surface-soft px-4 py-3">
      <div className="relative inline-flex items-center gap-2 group/profile-role">
        <div
          tabIndex={0}
          role="button"
          aria-haspopup="true"
          aria-describedby={tooltipId}
          aria-label={`Роль: ${persona.label}`}
          className="inline-flex items-center gap-1 rounded-full border border-subtle px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent-primary)] transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
        >
          {persona.label}
        </div>
        <div
          role="tooltip"
          id={tooltipId}
          className="pointer-events-none absolute left-0 top-full z-40 mt-2 w-max max-w-xs origin-top-left scale-95 rounded-xl border border-subtle bg-[var(--surface-0)] p-3 text-left text-xs text-[var(--text-primary)] opacity-0 shadow-soft transition-all duration-150 ease-out group-hover/profile-role:scale-100 group-hover/profile-role:opacity-100 group-focus-within/profile-role:scale-100 group-focus-within/profile-role:opacity-100"
        >
          <div className="leading-relaxed text-[var(--text-primary)]">{renderPersonaTooltip(persona.tooltipMd)}</div>
          {persona.slogan ? (
            <p className="mt-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">{persona.slogan}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  const display = value && value.trim().length > 0 ? value : 'не указано';
  if (href && value) {
    return (
      <div className="space-y-1 text-sm">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        <a href={href} className="font-medium text-[var(--accent-primary)]" target="_blank" rel="noreferrer">
          {display}
        </a>
      </div>
    );
  }
  return (
    <div className="space-y-1 text-sm">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-medium text-[var(--text-primary)]">{display}</p>
    </div>
  );
}

function formatBirthday(value?: string | null): string {
  if (!value) {
    return 'не указано';
  }
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return value;
  }
}

function renderPersonaTooltip(md: string): ReactNode[] {
  const result: ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(md))) {
    if (match.index > lastIndex) {
      result.push(md.slice(lastIndex, match.index));
    }
    result.push(
      <a
        key={`${match[2]}-${match.index}`}
        href={match[2]}
        target="_blank"
        rel="noreferrer noopener"
        className="text-[var(--accent-primary)] underline decoration-dotted"
      >
        {match[1]}
      </a>,
    );
    lastIndex = linkPattern.lastIndex;
  }

  if (lastIndex < md.length) {
    result.push(md.slice(lastIndex));
  }

  if (result.length === 0) {
    return [md];
  }

  return result;
}

function TimelineWidget({ items }: { items: DashboardTimelineItem[] }) {
  if (!items || items.length === 0) {
    return <SimpleEmptyState message="На сегодня ничего не запланировано." size="sm" />;
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 rounded-xl border border-subtle px-3 py-2 text-sm">
          <span className="w-16 shrink-0 rounded-lg bg-surface-soft px-2 py-1 text-center font-semibold text-[var(--accent-primary)]">
            {item.display_time}
          </span>
          <span className="text-[var(--text-primary)]">{item.title}</span>
        </li>
      ))}
    </ul>
  );
}

function QuickNoteWidget({ tick, onSuccess }: { tick: number; onSuccess: () => void }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    setValue('');
    setStatus('idle');
  }, [tick]);

  const mutation = useMutation({
    mutationFn: async (content: string) => {
      await apiFetch('/api/v1/notes', {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      setStatus('saved');
      setValue('');
      onSuccess();
      setTimeout(() => setStatus('idle'), 2000);
    },
    onError: () => {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    setStatus('saving');
    mutation.mutate(trimmed);
  };

  return (
    <form className="flex h-full flex-col gap-3" onSubmit={handleSubmit}>
      <Textarea
        placeholder="Быстрая заметка…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          Сохранить
        </Button>
        {status === 'saving' ? <span className="text-xs text-muted">Сохраняем…</span> : null}
        {status === 'saved' ? <span className="text-xs text-emerald-600">Сохранено</span> : null}
        {status === 'error' ? <span className="text-xs text-red-500">Не удалось сохранить</span> : null}
      </div>
    </form>
  );
}

function MetricWidget({ metric, fallbackTitle }: { metric?: DashboardMetric; fallbackTitle: string }) {
  if (!metric) {
    return <SimpleEmptyState message={`${fallbackTitle} появится после подключения данных.`} size="sm" />;
  }
  const delta = metric.delta_percent ?? 0;
  const deltaLabel = delta === 0 ? 'без изменений' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}%`;
  const deltaTone = delta === 0 ? 'text-muted' : delta > 0 ? 'text-emerald-600' : 'text-red-500';
  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <div>
        <p className="text-4xl font-semibold text-[var(--text-primary)]">
          {metric.value}
          {metric.unit ? <span className="ml-1 text-lg text-muted">{metric.unit}</span> : null}
        </p>
        <p className={clsx('text-xs font-medium uppercase tracking-wide', deltaTone)}>Δ {deltaLabel}</p>
      </div>
      <p className="text-xs text-muted">Данные обновляются автоматически при активности в системе.</p>
    </div>
  );
}

function ListWidget({
  items,
  emptyMessage,
  renderMeta,
}: {
  items: DashboardListItem[];
  emptyMessage: string;
  renderMeta?: (item: DashboardListItem) => ReactNode;
}) {
  if (!items || items.length === 0) {
    return <SimpleEmptyState message={emptyMessage} size="sm" />;
  }
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {items.map((item) => {
        const content = (
          <div className="flex flex-col gap-1 rounded-xl border border-subtle px-3 py-2 transition-base hover:border-[var(--accent-primary)] hover:bg-surface-soft">
            <span className="font-medium text-[var(--text-primary)]">{item.title}</span>
            {item.subtitle ? <span className="text-xs text-muted">{item.subtitle}</span> : null}
            {renderMeta ? renderMeta(item) : null}
          </div>
        );
        if (item.url && item.url.startsWith('/')) {
          return (
            <li key={item.id}>
              <Link href={item.url} className="block" prefetch={false}>
                {content}
              </Link>
            </li>
          );
        }
        if (item.url) {
          return (
            <li key={item.id}>
              <a href={item.url} target="_blank" rel="noreferrer" className="block">
                {content}
              </a>
            </li>
          );
        }
        return <li key={item.id}>{content}</li>;
      })}
    </ul>
  );
}

function HabitsWidget({ items }: { items: DashboardHabitItem[] }) {
  if (!items || items.length === 0) {
    return <SimpleEmptyState message="Добавьте привычки, чтобы отслеживать прогресс." />;
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-[var(--text-primary)]">{item.name}</span>
            <span className="text-muted">{item.percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-soft">
            <div
              className="h-full rounded-full bg-[var(--accent-primary)] transition-all"
              style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpleEmptyState({ message, size = 'md' }: { message: string; size?: 'sm' | 'md' }) {
  return (
    <div
      className={clsx(
        'flex items-center justify-center rounded-xl border border-dashed border-subtle bg-surface-soft text-muted',
        size === 'sm' ? 'px-4 py-6 text-sm text-center' : 'px-6 py-8 text-center text-sm',
      )}
    >
      {message}
    </div>
  );
}

function PlaceholderWidget({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-subtle bg-surface-soft p-6 text-sm text-muted">
      {message}
    </div>
  );
}
