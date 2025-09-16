'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError, buildQuery } from '../../lib/api';
import type { Area, Project, Task, Resource } from '../../lib/types';

interface InboxNote {
  id: number;
  title?: string | null;
  content: string;
}

interface CalendarItem {
  id: number;
  title: string;
  start_at: string;
  end_at?: string | null;
  tzid?: string | null;
  description?: string | null;
  project_id?: number | null;
  area_id?: number | null;
}

type AssignTarget = 'area' | 'project';

type AssignFormState = {
  target: AssignTarget;
  areaId: string;
  projectId: string;
};

type MomentumState = {
  streak: number;
  todayCount: number;
  lastProcessed: string | null;
};

const MOMENTUM_STORAGE_KEY = 'intdata.inbox.momentum.v1';
const DAILY_TARGET = 5;

function getDateKey(date: Date): string {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function diffInDays(from: string | null, to: string): number | null {
  if (!from) {
    return null;
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return null;
  }
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const normalizedFrom = new Date(fromDate);
  const normalizedTo = new Date(toDate);
  normalizedFrom.setHours(0, 0, 0, 0);
  normalizedTo.setHours(0, 0, 0, 0);
  return Math.round((normalizedTo.getTime() - normalizedFrom.getTime()) / MS_PER_DAY);
}

function loadMomentum(): MomentumState {
  if (typeof window === 'undefined') {
    return { streak: 0, todayCount: 0, lastProcessed: null };
  }
  try {
    const raw = window.localStorage.getItem(MOMENTUM_STORAGE_KEY);
    if (!raw) {
      return { streak: 0, todayCount: 0, lastProcessed: null };
    }
    const parsed = JSON.parse(raw) as MomentumState;
    if (
      typeof parsed?.streak === 'number' &&
      typeof parsed?.todayCount === 'number' &&
      (typeof parsed?.lastProcessed === 'string' || parsed?.lastProcessed === null)
    ) {
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to read Inbox momentum state', error);
  }
  return { streak: 0, todayCount: 0, lastProcessed: null };
}

function persistMomentum(state: MomentumState): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(MOMENTUM_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to persist Inbox momentum state', error);
  }
}

function findInboxArea(areas: Area[]): Area | null {
  const lowerVariants = ['inbox', 'входящие', 'нераспределенные', 'неразобранные'];
  const exact = areas.find((area) => {
    const slug = (area.slug || '').toLowerCase();
    return slug === 'inbox';
  });
  if (exact) {
    return exact;
  }
  return (
    areas.find((area) => {
      const name = area.name.toLowerCase();
      return lowerVariants.some((variant) => name.includes(variant));
    }) ?? null
  );
}

function useInboxMomentum() {
  const [state, setState] = useState<MomentumState>(() => loadMomentum());

  useEffect(() => {
    setState(loadMomentum());
  }, []);

  const todayKey = getDateKey(new Date());

  const registerProcessed = useCallback(() => {
    setState((prev) => {
      const daysDiff = diffInDays(prev.lastProcessed, todayKey);
      const alreadyToday = prev.lastProcessed === todayKey;
      const nextState: MomentumState = {
        streak: alreadyToday ? prev.streak : daysDiff === 1 ? prev.streak + 1 : 1,
        todayCount: alreadyToday ? prev.todayCount + 1 : 1,
        lastProcessed: todayKey,
      };
      persistMomentum(nextState);
      return nextState;
    });
  }, [todayKey]);

  const progress = Math.min(1, state.todayCount / DAILY_TARGET);
  const percent = Math.round(progress * 100);

  return {
    streak: state.streak,
    todayCount: state.todayCount,
    progress,
    percent,
    target: DAILY_TARGET,
    registerProcessed,
  };
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function formatDateTimeReadable(value: string): string {
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return value;
  }
}

interface FocusItem {
  kind: 'note';
  id: number;
  title: string;
  content: string;
}

export default function InboxModule() {
  const queryClient = useQueryClient();
  const momentum = useInboxMomentum();
  const [assignState, setAssignState] = useState<AssignFormState>({ target: 'area', areaId: '', projectId: '' });
  const [isFocusMode, setFocusMode] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);

  const areasQuery = useQuery<Area[]>({
    queryKey: ['areas'],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: () => apiFetch<Area[]>('/api/v1/areas'),
  });

  const areas = areasQuery.data ?? [];
  const inboxArea = useMemo(() => findInboxArea(areas), [areas]);
  const inboxAreaName = inboxArea?.name ?? 'Входящие';

  const notesQuery = useQuery<InboxNote[]>({
    queryKey: ['inbox', 'notes'],
    staleTime: 15_000,
    gcTime: 120_000,
    retry: false,
    queryFn: () => apiFetch<InboxNote[]>('/api/v1/inbox/notes'),
  });

  const notes = notesQuery.data ?? [];

  const tasksQuery = useQuery<Task[]>({
    queryKey: ['inbox', 'tasks', inboxArea?.id ?? 0],
    enabled: Boolean(inboxArea?.id),
    staleTime: 15_000,
    gcTime: 120_000,
    retry: false,
    queryFn: () => {
      if (!inboxArea?.id) {
        return Promise.resolve([] as Task[]);
      }
      const qs = buildQuery({ area_id: inboxArea.id, include_sub: 0 });
      return apiFetch<Task[]>(`/api/v1/tasks${qs}`);
    },
  });

  const rawTasks = tasksQuery.data ?? [];
  const activeTasks = useMemo(
    () => rawTasks.filter((task) => task.status !== 'done' && task.status !== 'archived'),
    [rawTasks],
  );

  const projectsQuery = useQuery<Project[]>({
    queryKey: ['inbox', 'projects', inboxArea?.id ?? 0],
    enabled: Boolean(inboxArea?.id),
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
    queryFn: () => {
      if (!inboxArea?.id) {
        return Promise.resolve([] as Project[]);
      }
      const qs = buildQuery({ area_id: inboxArea.id, include_sub: 0 });
      return apiFetch<Project[]>(`/api/v1/projects${qs}`);
    },
  });

  const projects = projectsQuery.data ?? [];

  const resourcesQuery = useQuery<Resource[]>({
    queryKey: ['resources'],
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
    queryFn: () => apiFetch<Resource[]>('/api/v1/resources'),
  });

  const resources = resourcesQuery.data ?? [];

  const calendarQuery = useQuery<CalendarItem[]>({
    queryKey: ['inbox', 'calendar', inboxArea?.id ?? 0],
    enabled: Boolean(inboxArea?.id),
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
    queryFn: () => {
      if (!inboxArea?.id) {
        return Promise.resolve([] as CalendarItem[]);
      }
      const now = new Date();
      const rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const rangeEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const qs = buildQuery({ from: rangeStart.toISOString(), to: rangeEnd.toISOString(), area_id: inboxArea.id });
      return apiFetch<CalendarItem[]>(`/api/v1/calendar/agenda${qs}`);
    },
  });

  const calendarItems = calendarQuery.data ?? [];

  const focusItems: FocusItem[] = useMemo(() => {
    return notes.map((note) => ({
      kind: 'note',
      id: note.id,
      title: note.title?.trim() || 'Без названия',
      content: note.content,
    }));
  }, [notes]);

  useEffect(() => {
    if (!isFocusMode) {
      setFocusIndex(0);
    } else if (focusIndex >= focusItems.length) {
      setFocusIndex(Math.max(0, focusItems.length - 1));
    }
  }, [focusItems.length, focusIndex, isFocusMode]);

  const { mutateAsync: assignNote, isPending: isAssigning, error: assignError } = useMutation({
    mutationFn: async ({
      noteId,
      target,
      containerId,
    }: {
      noteId: number;
      target: AssignTarget;
      containerId: number;
    }) => {
      return apiFetch(`/api/v1/notes/${noteId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ container_type: target, container_id: containerId }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData<InboxNote[] | undefined>(['inbox', 'notes'], (current) =>
        current?.filter((note) => note.id !== variables.noteId),
      );
      momentum.registerProcessed();
    },
  });

  const handleAssign = useCallback(async () => {
    const current = focusItems[focusIndex];
    if (!current) {
      return;
    }
    if (assignState.target === 'area') {
      const areaId = assignState.areaId ? Number(assignState.areaId) : null;
      if (!areaId) {
        return;
      }
      await assignNote({ noteId: current.id, target: 'area', containerId: areaId });
    } else {
      const projectId = assignState.projectId ? Number(assignState.projectId) : null;
      if (!projectId) {
        return;
      }
      await assignNote({ noteId: current.id, target: 'project', containerId: projectId });
    }
    setAssignState((prev) => ({ ...prev }));
  }, [assignNote, assignState.areaId, assignState.projectId, assignState.target, focusItems]);

  const assignDisabled =
    isAssigning ||
    !focusItems[focusIndex] ||
    (assignState.target === 'area' ? !assignState.areaId : !assignState.projectId);

  const totalCaptured = notes.length + activeTasks.length + projects.length + calendarItems.length;
  const totalQueue = totalCaptured + resources.length;

  const isLoading =
    areasQuery.isLoading ||
    notesQuery.isLoading ||
    tasksQuery.isLoading ||
    projectsQuery.isLoading ||
    calendarQuery.isLoading ||
    resourcesQuery.isLoading;

  const hasError =
    areasQuery.isError ||
    notesQuery.isError ||
    tasksQuery.isError ||
    projectsQuery.isError ||
    calendarQuery.isError ||
    resourcesQuery.isError;

  const nextNote = focusItems[focusIndex];
  const firstNote = focusItems[0];

  const availableAreas = useMemo(
    () => areas.filter((area) => !inboxArea || area.id !== inboxArea.id),
    [areas, inboxArea],
  );

  const inboxOverloaded = totalCaptured > 12;

  return (
    <div className="flex flex-col gap-8">
      <section className="overflow-hidden rounded-2xl border border-subtle bg-gradient-to-br from-[var(--surface-0)] via-[var(--surface-0)] to-[var(--accent-primary-soft)] p-6 text-[var(--text-primary)] md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-2xl flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--accent-primary-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
              {inboxAreaName === 'Входящие' ? 'Входящие' : `${inboxAreaName} · Inbox`}
            </span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Центральное место для всех неразобранных идей, задач и событий
            </h2>
            <p className="text-base text-muted">
              Всё, что попадает в {inboxAreaName}, автоматически относится к системной области «Неразобранные».
              Разберите элементы — назначьте их в проект или конкретную область — и они исчезнут из этого списка, чтобы не превращаться в потеряшки.
            </p>
            <ul className="flex flex-wrap gap-3 text-sm text-muted">
              <li className="inline-flex items-center gap-2 rounded-full bg-surface-soft px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
                Заметки, идеи, клипперы
              </li>
              <li className="inline-flex items-center gap-2 rounded-full bg-surface-soft px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
                Задачи и таймеры без проекта
              </li>
              <li className="inline-flex items-center gap-2 rounded-full bg-surface-soft px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-sky-500/80" />
                События календаря без контекста
              </li>
              <li className="inline-flex items-center gap-2 rounded-full bg-surface-soft px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-amber-500/80" />
                Черновики проектов и ресурсов
              </li>
            </ul>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-subtle bg-[var(--surface-0)] p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted">Серия разборов</span>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-primary)]">{momentum.streak} дней</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <div className="text-3xl font-semibold text-[var(--text-primary)]">{momentum.todayCount}</div>
                <div className="text-sm text-muted">из {DAILY_TARGET} целей на сегодня</div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-soft">
                <div
                  className="h-2 rounded-full bg-[var(--accent-primary)] transition-all duration-500"
                  style={{ width: `${momentum.percent}%` }}
                  aria-hidden
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFocusMode(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-on-primary)] transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
            >
              Начать фокус-сессию
            </button>
            {inboxOverloaded ? (
              <p className="text-xs text-amber-600">
                Входящие растут быстрее, чем вы их разбираете. Забронируйте время в календаре и вернитесь с новым фокусом.
              </p>
            ) : (
              <p className="text-xs text-muted">
                Разбирайте хотя бы {DAILY_TARGET} элементов в день, чтобы не копить хвосты и держать мозг свободным.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Заметки" value={formatCount(notes.length)} hint="Быстрые захваты из бота и веб-форм" trend={notes.length === 0 ? 'Все разобраны' : `${notes.length} ожидают назначения`} />
        <StatCard title="Задачи" value={formatCount(activeTasks.length)} hint="Требуют распределения или уточнения" trend={activeTasks.length === 0 ? 'Нет задач в Inbox' : 'Проверьте статусы и дедлайны'} badge="PARA" />
        <StatCard title="События" value={formatCount(calendarItems.length)} hint="Появились без проекта/области" trend={calendarItems.length === 0 ? 'Календарь чист' : 'Назначьте контекст'} badge="Calendar" />
        <StatCard title="Ресурсы" value={formatCount(resources.length)} hint="Сохранённые материалы и клипы" trend={resources.length === 0 ? 'Ничего не ждёт' : 'Подберите им место'} badge="Knowledge" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex flex-col gap-4 rounded-2xl border border-subtle bg-[var(--surface-0)] p-6">
          <header className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Фокус-сессия Inbox Zero</h3>
            <p className="text-sm text-muted">Просматривайте элементы по одному и сразу назначайте им место в PARA.</p>
          </header>
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <SkeletonLine />
              <SkeletonLine />
              <SkeletonLine />
            </div>
          ) : !isFocusMode ? (
            <div className="flex flex-col gap-4 rounded-xl border border-dashed border-subtle-soft bg-surface-soft p-6">
              <div className="flex flex-col gap-2">
                <h4 className="text-base font-semibold text-[var(--text-primary)]">Готовы разобраться?</h4>
                <p className="text-sm text-muted">
                  Запустите фокус-сессию, чтобы просматривать элементы по одному и назначать им область или проект без переключений.
                </p>
                {firstNote ? (
                  <div className="rounded-lg border border-subtle bg-[var(--surface-0)] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Следующий в очереди</div>
                    <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">{firstNote.title}</div>
                    <p className="mt-1 text-sm text-muted">{firstNote.content.substring(0, 140)}{firstNote.content.length > 140 ? '…' : ''}</p>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFocusMode(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-on-primary)] transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
                >
                  Начать разбор
                </button>
                <span className="text-xs text-muted">Осталось {formatCount(focusItems.length)} элементов</span>
              </div>
            </div>
          ) : focusItems.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-subtle-soft bg-surface-soft p-8 text-center">
              <svg
                aria-hidden
                className="h-10 w-10 text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 11h8M9 15h6" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
              </svg>
              <div className="flex flex-col gap-2">
                <h4 className="text-base font-semibold text-[var(--text-primary)]">Все входящие разобраны</h4>
                <p className="text-sm text-muted">Создайте новую заметку, задачу или событие — они появятся здесь и будут ждать назначения.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between text-sm text-muted">
                <span>
                  Элемент {focusIndex + 1} из {focusItems.length}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg px-2 py-1 font-medium text-[var(--accent-primary)] transition-base hover:bg-[var(--accent-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
                  onClick={() => {
                    setFocusMode(false);
                    setFocusIndex(0);
                  }}
                >
                  Скрыть фокус
                </button>
              </div>
              <article className="flex flex-col gap-3 rounded-xl border border-subtle bg-surface-soft p-5">
                <header className="flex flex-col gap-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Заметка</div>
                  <h4 className="text-lg font-semibold text-[var(--text-primary)]">{nextNote?.title}</h4>
                </header>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">{nextNote?.content}</p>
              </article>
              <div className="grid gap-4 md:grid-cols-[minmax(0,0.5fr)_minmax(0,0.5fr)]">
                <div className="flex flex-col gap-2">
                  <label htmlFor="assign-target" className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Куда отправить
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] ${
                        assignState.target === 'area'
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--text-primary)]'
                          : 'border-subtle text-muted hover:text-[var(--text-primary)]'
                      }`}
                      onClick={() => setAssignState((prev) => ({ ...prev, target: 'area' }))}
                    >
                      Область
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] ${
                        assignState.target === 'project'
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--text-primary)]'
                          : 'border-subtle text-muted hover:text-[var(--text-primary)]'
                      }`}
                      onClick={() => setAssignState((prev) => ({ ...prev, target: 'project' }))}
                    >
                      Проект
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    {assignState.target === 'area' ? 'Выберите область' : 'Выберите проект'}
                  </label>
                  {assignState.target === 'area' ? (
                    <select
                      className="w-full rounded-lg border border-subtle bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                      value={assignState.areaId}
                      onChange={(event) =>
                        setAssignState((prev) => ({ ...prev, areaId: event.target.value, projectId: '' }))
                      }
                    >
                      <option value="">Назначить область</option>
                      {availableAreas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      className="w-full rounded-lg border border-subtle bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                      value={assignState.projectId}
                      onChange={(event) =>
                        setAssignState((prev) => ({ ...prev, projectId: event.target.value }))
                      }
                    >
                      <option value="">Выберите проект</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              {assignError instanceof ApiError ? (
                <p className="rounded-lg border border-red-500/40 bg-red-100/60 px-3 py-2 text-sm text-red-600">
                  {assignError.message}
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-on-primary)] transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleAssign}
                  disabled={assignDisabled}
                >
                  {isAssigning ? 'Сохраняю…' : 'Сохранить и дальше'}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-muted transition-base hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
                  onClick={() => setFocusIndex((prev) => Math.min(prev + 1, focusItems.length))}
                  disabled={!focusItems[focusIndex + 1]}
                >
                  Пропустить
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-subtle bg-[var(--surface-0)] p-6">
          <header className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Очередь на разбор</h3>
            <p className="text-sm text-muted">Краткий обзор всего, что ещё нужно распаковать из Inbox.</p>
          </header>
          <div className="flex flex-col gap-4">
            <QueueSection
              title="Заметки"
              items={notes.map((note) => ({
                id: note.id,
                title: note.title?.trim() || 'Без названия',
                description: note.content.substring(0, 140),
              }))}
              emptyMessage="Нет заметок в ожидании"
              actionLabel="Открыть заметки"
              href="/notes"
            />
            <QueueSection
              title="Задачи"
              items={activeTasks.map((task) => ({
                id: task.id,
                title: task.title,
                description: task.description ?? 'Задача из Inbox',
              }))}
              emptyMessage="Все задачи распределены"
              actionLabel="Управлять задачами"
              href="/tasks"
            />
            <QueueSection
              title="События"
              items={calendarItems.map((item) => ({
                id: item.id,
                title: item.title,
                description: item.start_at ? `Запланировано на ${formatDateTimeReadable(item.start_at)}` : 'Без даты',
              }))}
              emptyMessage="Нет несортированных событий"
              actionLabel="Открыть календарь"
              href="/calendar"
            />
            <QueueSection
              title="Черновики проектов"
              items={projects.map((project) => ({
                id: project.id,
                title: project.name,
                description: 'Назначьте проекту область и статус',
              }))}
              emptyMessage="Проекты уже распределены"
              actionLabel="Открыть проекты"
              href="/projects"
            />
            <QueueSection
              title="Ресурсы"
              items={resources.map((resource) => ({
                id: resource.id,
                title: resource.title,
                description: resource.type ? `Тип: ${resource.type}` : 'Сохранённый материал',
              }))}
              emptyMessage="Новых материалов нет"
              actionLabel="Перейти к ресурсам"
              href="/resources"
            />
          </div>
          <footer className="rounded-xl border border-dashed border-subtle-soft bg-surface-soft px-4 py-3 text-sm text-muted">
            Всего в очереди: {formatCount(totalQueue)} элементов. Начните с заметок — это самый быстрый способ поддержать порядок, а затем двигайтесь к задачам и событиям.
          </footer>
        </div>
      </section>

      {hasError ? (
        <section className="rounded-2xl border border-red-500/40 bg-red-100/60 px-4 py-3 text-sm text-red-600">
          Не удалось загрузить часть данных Inbox. Попробуйте обновить страницу — если проблема сохраняется, проверьте соединение или повторите попытку позже.
        </section>
      ) : null}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  hint: string;
  trend: string;
  badge?: string;
}

function StatCard({ title, value, hint, trend, badge }: StatCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-subtle bg-[var(--surface-0)] p-5 shadow-soft">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
          <div className="text-xs text-muted">{hint}</div>
        </div>
        {badge ? (
          <span className="rounded-full bg-surface-soft px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted">
            {badge}
          </span>
        ) : null}
      </header>
      <div className="text-3xl font-semibold text-[var(--text-primary)]">{value}</div>
      <div className="text-sm text-muted">{trend}</div>
    </article>
  );
}

interface QueueItem {
  id: number;
  title: string;
  description: string;
}

interface QueueSectionProps {
  title: string;
  items: QueueItem[];
  emptyMessage: string;
  actionLabel: string;
  href: string;
}

function QueueSection({ title, items, emptyMessage, actionLabel, href }: QueueSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">{title}</h4>
        <Link
          href={href}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-primary)] transition-base hover:opacity-80"
        >
          {actionLabel}
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-subtle-soft bg-surface-soft px-4 py-6 text-sm text-muted">
          {emptyMessage}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.slice(0, 4).map((item) => (
            <li key={item.id} className="rounded-xl border border-subtle bg-[var(--surface-0)] p-4 shadow-sm">
              <div className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</div>
              <p className="mt-1 text-sm text-muted">{item.description}</p>
            </li>
          ))}
          {items.length > 4 ? (
            <li className="text-xs text-muted">… и ещё {items.length - 4}</li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

function SkeletonLine() {
  return <div className="h-3 w-full animate-pulse rounded-full bg-surface-soft" />;
}
