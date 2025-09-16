'use client';

import React, { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import PageLayout from '../PageLayout';
import { apiFetch, ApiError, buildQuery } from '../../lib/api';
import type { Area, Project, Task } from '../../lib/types';
import { buildAreaOptions } from '../../lib/areas';
import { formatDateTime, formatMinutes } from '../../lib/time';

const MODULE_TITLE = 'Задачи';
const MODULE_DESCRIPTION = 'Создавайте задачи, отслеживайте прогресс и управляйте таймерами в едином интерфейсе.';

type TaskCreatePayload = {
  title: string;
  description?: string | null;
  due_date?: string | null;
  project_id?: number | null;
  area_id: number;
};

interface TaskFormState {
  title: string;
  description: string;
  areaId: string;
  projectId: string;
  dueDate: string;
}

interface TaskFilterState {
  areaId: string;
  includeSub: boolean;
}

function useAreas() {
  return useQuery<Area[]>({
    queryKey: ['areas'],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: () => apiFetch<Area[]>('/api/v1/areas'),
  });
}

function useProjectsQuery() {
  return useQuery<Project[]>({
    queryKey: ['projects', 'all'],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: () => apiFetch<Project[]>('/api/v1/projects'),
  });
}

function useTasks(filters: TaskFilterState) {
  return useQuery<Task[]>({
    queryKey: ['tasks', filters.areaId, filters.includeSub],
    staleTime: 15_000,
    gcTime: 300_000,
    queryFn: () => {
      const areaId = filters.areaId ? Number(filters.areaId) : undefined;
      const qs = buildQuery({
        area_id: areaId,
        include_sub: areaId && filters.includeSub ? 1 : undefined,
      });
      return apiFetch<Task[]>(`/api/v1/tasks${qs}`);
    },
  });
}

export default function TasksModule() {
  const areasQuery = useAreas();
  const projectsQuery = useProjectsQuery();
  const [filterForm, setFilterForm] = useState<TaskFilterState>({ areaId: '', includeSub: false });
  const [filters, setFilters] = useState<TaskFilterState>({ areaId: '', includeSub: false });
  const [form, setForm] = useState<TaskFormState>({ title: '', description: '', areaId: '', projectId: '', dueDate: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: 'start' | 'stop' | 'done'; taskId: number } | null>(null);

  const tasksQuery = useTasks(filters);

  const areaOptions = useMemo(() => buildAreaOptions(areasQuery.data ?? []), [areasQuery.data]);
  const projectsByArea = useMemo(() => {
    const data = projectsQuery.data ?? [];
    const result = new Map<number, Project[]>();
    data.forEach((project) => {
      const list = result.get(project.area_id);
      if (list) {
        list.push(project);
      } else {
        result.set(project.area_id, [project]);
      }
    });
    return result;
  }, [projectsQuery.data]);

  const filteredProjects = useMemo(() => {
    if (!form.areaId) {
      return [] as Project[];
    }
    const id = Number(form.areaId);
    return projectsByArea.get(id) ?? [];
  }, [form.areaId, projectsByArea]);

  const createMutation = useMutation({
    mutationFn: async (payload: TaskCreatePayload) => {
      return apiFetch<Task>('/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setForm({ title: '', description: '', areaId: '', projectId: '', dueDate: '' });
      setFormError(null);
      tasksQuery.refetch();
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        const details = typeof error.info === 'object' && error.info !== null ? (error.info as any).detail : null;
        setFormError(details ?? error.message);
        return;
      }
      setFormError('Не удалось создать задачу');
    },
  });

  const startMutation = useMutation({
    mutationFn: (taskId: number) => apiFetch<Task>(`/api/v1/tasks/${taskId}/start_timer`, { method: 'POST' }),
    onMutate: (taskId: number) => {
      setPendingAction({ type: 'start', taskId });
    },
    onSuccess: () => {
      setActionError(null);
      tasksQuery.refetch();
    },
    onError: (error: unknown) => {
      setActionError(error instanceof ApiError ? error.message : 'Не удалось запустить таймер');
    },
    onSettled: () => {
      setPendingAction(null);
    },
  });

  const stopMutation = useMutation({
    mutationFn: (taskId: number) => apiFetch<Task>(`/api/v1/tasks/${taskId}/stop_timer`, { method: 'POST' }),
    onMutate: (taskId: number) => {
      setPendingAction({ type: 'stop', taskId });
    },
    onSuccess: () => {
      setActionError(null);
      tasksQuery.refetch();
    },
    onError: (error: unknown) => {
      setActionError(error instanceof ApiError ? error.message : 'Не удалось остановить таймер');
    },
    onSettled: () => {
      setPendingAction(null);
    },
  });

  const doneMutation = useMutation({
    mutationFn: (taskId: number) => apiFetch<Task>(`/api/v1/tasks/${taskId}/done`, { method: 'POST' }),
    onMutate: (taskId: number) => {
      setPendingAction({ type: 'done', taskId });
    },
    onSuccess: () => {
      setActionError(null);
      tasksQuery.refetch();
    },
    onError: (error: unknown) => {
      setActionError(error instanceof ApiError ? error.message : 'Не удалось завершить задачу');
    },
    onSettled: () => {
      setPendingAction(null);
    },
  });

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ ...filterForm });
  };

  const handleTaskSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setFormError('Название обязательно');
      return;
    }
    if (!form.areaId) {
      setFormError('Выберите область');
      return;
    }
    const payload: TaskCreatePayload = {
      title: form.title.trim(),
      description: form.description.trim() ? form.description.trim() : null,
      due_date: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      area_id: Number(form.areaId),
      project_id: form.projectId ? Number(form.projectId) : null,
    };
    createMutation.mutate(payload);
  };

  const isLoading = tasksQuery.isLoading || areasQuery.isLoading || projectsQuery.isLoading;
  const loadError = (areasQuery.error ?? projectsQuery.error ?? tasksQuery.error) as unknown;
  const loadErrorMessage = loadError
    ? loadError instanceof ApiError
      ? loadError.message
      : 'Не удалось загрузить данные'
    : null;

  const tasks = tasksQuery.data ?? [];
  const showEmpty = !isLoading && tasks.length === 0;

  const refetchAll = () => {
    tasksQuery.refetch();
  };

  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION}>
      <section className="flex flex-col gap-6">
        <form className="rounded-2xl border border-subtle bg-surface-soft p-6" onSubmit={handleFilterSubmit}>
          <div className="card-title text-base font-semibold text-[var(--text-primary)]">Фильтр задач</div>
          <div className="mt-4 grid gap-4 md:grid-cols-[2fr,1fr,auto]">
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="filter-area">
              Область
              <select
                id="filter-area"
                value={filterForm.areaId}
                onChange={(event) => setFilterForm((prev) => ({ ...prev, areaId: event.target.value }))}
                className="rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                disabled={areasQuery.isLoading}
              >
                <option value="">— без фильтра —</option>
                {areaOptions.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 text-sm text-muted" htmlFor="filter-include-sub">
              <input
                id="filter-include-sub"
                type="checkbox"
                checked={filterForm.includeSub}
                onChange={(event) => setFilterForm((prev) => ({ ...prev, includeSub: event.target.checked }))}
                className="h-4 w-4 rounded border-subtle"
                disabled={!filterForm.areaId}
              />
              Включать подкатегории
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--accent-on-primary)] transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
              >
                Показать
              </button>
            </div>
          </div>
        </form>

        <form className="rounded-2xl border border-subtle bg-surface-soft p-6" onSubmit={handleTaskSubmit}>
          <div className="card-title text-base font-semibold text-[var(--text-primary)]">Новая задача</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="task-title">
              Название
              <input
                id="task-title"
                type="text"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Что нужно сделать?"
                className="rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="task-due">
              Срок (опционально)
              <input
                id="task-due"
                type="datetime-local"
                value={form.dueDate}
                onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                className="rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted md:col-span-2" htmlFor="task-description">
              Описание (опционально)
              <textarea
                id="task-description"
                rows={3}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Кратко опишите задачу"
                className="min-h-[96px] rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="task-area">
              Область
              <select
                id="task-area"
                value={form.areaId}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((prev) => ({ ...prev, areaId: value, projectId: '' }));
                }}
                className="rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                required
              >
                <option value="">— выберите область —</option>
                {areaOptions.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="task-project">
              Проект (опционально)
              <select
                id="task-project"
                value={form.projectId}
                onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}
                className="rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                disabled={!form.areaId || filteredProjects.length === 0}
              >
                <option value="">— без проекта —</option>
                {filteredProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {formError ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div> : null}
          <div className="mt-4 flex items-center justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--accent-on-primary)] transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] disabled:cursor-progress disabled:opacity-70"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Сохраняем…' : 'Добавить задачу'}
            </button>
          </div>
        </form>

        {actionError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{actionError}</div>
        ) : null}
        {loadErrorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{loadErrorMessage}</div>
        ) : null}

        <div className="rounded-2xl border border-subtle">
          <div className="flex items-center justify-between border-b border-subtle bg-surface-soft px-4 py-3">
            <div className="text-sm font-semibold text-[var(--text-primary)]">Мои задачи</div>
            <button
              type="button"
              onClick={refetchAll}
              className="inline-flex items-center gap-2 rounded-lg border border-subtle bg-[var(--surface-0)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-base hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] disabled:cursor-progress disabled:opacity-70"
              disabled={tasksQuery.isFetching}
            >
              Обновить
            </button>
          </div>
          <table className="w-full table-fixed border-collapse text-sm">
            <thead className="bg-surface-soft text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Название</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Срок</th>
                <th className="px-4 py-3 font-medium">Время</th>
                <th className="px-4 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`loading-${index}`} className="animate-pulse border-t border-subtle-soft">
                    <td className="px-4 py-3">
                      <div className="h-3 w-10 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-3 w-40 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-3 w-20 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-3 w-28 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-3 w-16 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-3 w-32 rounded-full bg-surface-soft" />
                    </td>
                  </tr>
                ))
              ) : showEmpty ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted">
                    Задач пока нет — создайте первую или скорректируйте фильтры.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const isRunning = Boolean(task.running_entry_id);
                  return (
                    <tr key={task.id} className="border-t border-subtle">
                      <td className="px-4 py-3 font-mono text-xs text-muted">#{task.id}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-primary)]">
                        <div className="font-medium">{task.title}</div>
                        {task.description ? <div className="text-xs text-muted">{task.description}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-sm capitalize text-[var(--text-primary)]">{task.status}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{formatDateTime(task.due_date)}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{formatMinutes(task.tracked_minutes)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => (isRunning ? stopMutation.mutate(task.id) : startMutation.mutate(task.id))}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] ${
                              isRunning
                                ? 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                                : 'border border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-on-primary)] hover:opacity-90'
                            } disabled:cursor-progress disabled:opacity-60`}
                            disabled={
                              (pendingAction?.taskId === task.id && pendingAction.type === 'stop' && isRunning) ||
                              (pendingAction?.taskId === task.id && pendingAction.type === 'start' && !isRunning)
                            }
                          >
                            {isRunning ? 'Стоп' : task.tracked_minutes > 0 ? 'Продолжить' : 'Старт'}
                          </button>
                          <button
                            type="button"
                            onClick={() => doneMutation.mutate(task.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-subtle bg-[var(--surface-0)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-base hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] disabled:cursor-progress disabled:opacity-60"
                            disabled={pendingAction?.taskId === task.id && pendingAction.type === 'done'}
                          >
                            Готово
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PageLayout>
  );
}
