'use client';

import React, { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import PageLayout from '../PageLayout';
import { apiFetch, ApiError, buildQuery } from '../../lib/api';
import type { Area, Project, Task, TaskStats } from '../../lib/types';
import { buildAreaOptions } from '../../lib/areas';
import { formatDateTime, formatMinutes } from '../../lib/time';
import { Button, Card, Checkbox, Field, Input, Select, Textarea } from '../ui';

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

function useTaskStats() {
  return useQuery<TaskStats>({
    queryKey: ['tasks', 'stats'],
    staleTime: 15_000,
    gcTime: 60_000,
    queryFn: () => apiFetch<TaskStats>('/api/v1/tasks/stats'),
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
  const statsQuery = useTaskStats();

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
      statsQuery.refetch();
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
      statsQuery.refetch();
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
      statsQuery.refetch();
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
      statsQuery.refetch();
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
    statsQuery.refetch();
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
    statsQuery.refetch();
  };

  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION}>
      <form onSubmit={handleFilterSubmit} className="space-y-0">
        <Card surface="soft" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-base font-semibold text-[var(--text-primary)]">Фильтр задач</div>
            <div className="flex items-center gap-3">
              <Field label="Область" className="min-w-[220px]" required={false} htmlFor="filter-area">
                <Select
                  id="filter-area"
                  value={filterForm.areaId}
                  onChange={(event) => setFilterForm((prev) => ({ ...prev, areaId: event.target.value }))}
                  disabled={areasQuery.isLoading}
                >
                  <option value="">— без фильтра —</option>
                  {areaOptions.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-muted">
                <Checkbox
                  id="filter-include-sub"
                  checked={filterForm.includeSub}
                  onChange={(event) => setFilterForm((prev) => ({ ...prev, includeSub: event.target.checked }))}
                  disabled={!filterForm.areaId}
                />
                Включать подкатегории
              </label>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              Показать
            </Button>
          </div>
        </Card>
      </form>

      <form onSubmit={handleTaskSubmit} className="space-y-0">
        <Card surface="soft" className="flex flex-col gap-6">
          <div className="text-base font-semibold text-[var(--text-primary)]">Новая задача</div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название" required htmlFor="task-title">
              <Input
                id="task-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Что нужно сделать?"
                required
              />
            </Field>
            <Field label="Срок (опционально)" htmlFor="task-due">
              <Input
                id="task-due"
                type="datetime-local"
                value={form.dueDate}
                onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
              />
            </Field>
            <Field label="Область" required htmlFor="task-area">
              <Select
                id="task-area"
                value={form.areaId}
                onChange={(event) => setForm((prev) => ({ ...prev, areaId: event.target.value }))}
                disabled={areasQuery.isLoading}
                required
              >
                <option value="">— выберите область —</option>
                {areaOptions.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Проект (опционально)" htmlFor="task-project">
              <Select
                id="task-project"
                value={form.projectId}
                onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}
                disabled={!form.areaId || filteredProjects.length === 0}
              >
                <option value="">— без проекта —</option>
                {filteredProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Описание (опционально)" className="md:col-span-2" htmlFor="task-description">
              <Textarea
                id="task-description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                placeholder="Расскажите команде детали или ссылки"
              />
            </Field>
          </div>
          {formError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
              {formError}
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Сохраняем…' : 'Добавить задачу'}
            </Button>
          </div>
        </Card>
      </form>

      {actionError ? (
        <Card className="border-red-200/80 bg-red-50 text-sm text-red-700" role="alert">
          {actionError}
        </Card>
      ) : null}
      {loadErrorMessage ? (
        <Card className="border-red-200/80 bg-red-50 text-sm text-red-700" role="alert">
          {loadErrorMessage}
        </Card>
      ) : null}

      <Card surface="soft" className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-subtle bg-[var(--surface-0)] px-4 py-3 text-center">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Выполнено</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
            {typeof statsQuery.data?.done === 'number' ? statsQuery.data.done : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-subtle bg-[var(--surface-0)] px-4 py-3 text-center">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Актуально</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
            {typeof statsQuery.data?.active === 'number' ? statsQuery.data.active : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-subtle bg-[var(--surface-0)] px-4 py-3 text-center">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Отказались</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
            {typeof statsQuery.data?.dropped === 'number' ? statsQuery.data.dropped : '—'}
          </div>
        </div>
      </Card>

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle bg-surface-soft px-5 py-4">
          <div className="text-sm font-semibold text-[var(--text-primary)]">Мои задачи</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refetchAll}
            disabled={tasksQuery.isFetching}
          >
            Обновить
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border-collapse text-sm">
            <thead className="bg-surface-soft text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium">Название</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Контроль</th>
                <th className="px-5 py-3 font-medium">Наблюдение</th>
                <th className="px-5 py-3 font-medium">Срок</th>
                <th className="px-5 py-3 font-medium">Время</th>
                <th className="px-5 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`loading-${index}`} className="animate-pulse border-t border-subtle-soft">
                    <td className="px-5 py-3">
                      <div className="h-3 w-10 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-3 w-40 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-3 w-20 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-3 w-28 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-3 w-14 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-3 w-24 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-3 w-32 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-3 w-20 rounded-full bg-surface-soft" />
                    </td>
                  </tr>
                ))
              ) : showEmpty ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-muted">
                    Задач пока нет — создайте первую или скорректируйте фильтры.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const isRunning = Boolean(task.running_entry_id);
                  const controlActive = Boolean(task.control_enabled);
                  const controlLabel = controlActive
                    ? `${task.control_status === 'done' ? 'Завершён' : 'Активен'}${task.control_frequency ? ` / ${task.control_frequency} мин` : ''}`
                    : task.control_status === 'done'
                      ? 'Выполнена'
                      : '—';
                  const nextControl = controlActive && task.control_next_at ? formatDateTime(task.control_next_at) : null;
                  return (
                    <tr key={task.id} className="border-t border-subtle">
                      <td className="px-5 py-3 font-mono text-xs text-muted">#{task.id}</td>
                      <td className="px-5 py-3 text-sm text-[var(--text-primary)]">
                        <div className="font-medium">{task.title}</div>
                        {task.description ? <div className="text-xs text-muted">{task.description}</div> : null}
                      </td>
                      <td className="px-5 py-3 text-sm capitalize text-[var(--text-primary)]">{task.status}</td>
                      <td className="px-5 py-3 text-sm text-[var(--text-primary)]">
                        {controlLabel}
                        {nextControl ? <div className="text-xs text-muted">след.: {nextControl}</div> : null}
                      </td>
                      <td className="px-5 py-3 text-sm text-[var(--text-primary)]">{task.is_watched ? 'Да' : '—'}</td>
                      <td className="px-5 py-3 text-sm text-[var(--text-primary)]">{task.due_date ? formatDateTime(task.due_date) : '—'}</td>
                      <td className="px-5 py-3 text-sm text-[var(--text-primary)]">{formatMinutes(task.tracked_minutes)}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={isRunning ? 'danger' : 'primary'}
                            onClick={() => (isRunning ? stopMutation.mutate(task.id) : startMutation.mutate(task.id))}
                            disabled={
                              (pendingAction?.taskId === task.id && pendingAction.type === 'stop' && isRunning) ||
                              (pendingAction?.taskId === task.id && pendingAction.type === 'start' && !isRunning)
                            }
                          >
                            {isRunning ? 'Стоп' : task.tracked_minutes > 0 ? 'Продолжить' : 'Старт'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => doneMutation.mutate(task.id)}
                            disabled={pendingAction?.taskId === task.id && pendingAction.type === 'done'}
                          >
                            Готово
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PageLayout>
  );
}
