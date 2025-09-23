'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageLayout from '../PageLayout';
import { apiFetch, ApiError, buildQuery } from '../../lib/api';
import type { Area, Project } from '../../lib/types';
import { buildAreaOptions } from '../../lib/areas';
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, Select } from '../ui';

const MODULE_TITLE = 'Привычки';
const MODULE_DESCRIPTION =
  'Следите за прогрессом привычек, отмечайте выполнение и управляйте ритуалами в едином пространстве.';

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Ежедневно',
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
};

type Frequency = 'daily' | 'weekly' | 'monthly';

interface Habit {
  id: number;
  title?: string;
  name?: string;
  frequency: Frequency;
  progress?: string[];
  note?: string | null;
  area_id?: number | null;
  project_id?: number | null;
  created_at?: string | null;
}

type HabitTitleSource = Pick<Habit, 'title' | 'name'>;

interface HabitCreatePayload {
  name: string;
  frequency: Frequency;
  area_id?: number;
  project_id?: number;
}

interface HabitStats {
  level: number;
  xp: number;
  gold: number;
  hp: number;
  kp: number;
  daily_xp: number;
  daily_gold: number;
}

interface DailyItem {
  id: number;
  title: string;
  note?: string | null;
  rrule: string;
  difficulty?: string | null;
  streak: number;
  frozen: boolean;
  area_id?: number | null;
  project_id?: number | null;
}

interface RewardItem {
  id: number;
  title: string;
  cost_gold: number;
  area_id?: number | null;
  project_id?: number | null;
}

interface HabitsDashboardPayload {
  habits: Habit[];
  dailies: DailyItem[];
  rewards: RewardItem[];
  stats: HabitStats;
}

interface HabitFormState {
  name: string;
  frequency: Frequency;
  areaId: string;
  projectId: string;
}

interface HabitFilterState {
  areaId: string;
  projectId: string;
  includeSub: boolean;
}

interface HabitActionState {
  type: 'toggle' | 'delete';
  habitId: number;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeProgressStats(progress: string[] | undefined) {
  if (!progress || progress.length === 0) {
    return { percent: 0, todayDone: false };
  }
  const set = new Set(progress);
  const today = todayISO();
  let done = 0;
  for (let i = 0; i < 30; i += 1) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    if (set.has(key)) {
      done += 1;
    }
  }
  const percent = Math.round((done / 30) * 100);
  const todayDone = set.has(today);
  return { percent, todayDone };
}

function resolveHabitTitle(h: HabitTitleSource): string {
  return h.title ?? h.name ?? 'Без названия';
}

function getFrequencyLabel(freq: string | undefined): string {
  return FREQUENCY_LABELS[freq ?? 'daily'] ?? freq ?? '—';
}

function formatAreaLabel(areaName: string | undefined, projectName: string | undefined) {
  if (projectName) {
    return `${projectName} • ${areaName ?? '—'}`;
  }
  return areaName ?? '—';
}

function isTelegramRequired(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (error.status !== 403) {
    return false;
  }
  const info = error.info;
  if (info && typeof info === 'object' && 'error' in info) {
    const err = (info as { error?: string }).error;
    return err === 'tg_link_required';
  }
  return false;
}

function describeCooldown(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 429) {
    return null;
  }
  const info = error.info;
  const retry =
    info && typeof info === 'object' && 'retry_after' in info
      ? Number((info as { retry_after?: number }).retry_after ?? 0)
      : 0;
  if (!retry || Number.isNaN(retry)) {
    return 'Сработал кулдаун: повторите попытку через несколько секунд.';
  }
  return `Сработал кулдаун: повторите попытку через ${retry} секунд.`;
}

export default function HabitsModule() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<HabitFormState>({ name: '', frequency: 'daily', areaId: '', projectId: '' });
  const [filters, setFilters] = useState<HabitFilterState>({ areaId: '', projectId: '', includeSub: false });
  const [requiresTelegram, setRequiresTelegram] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<HabitActionState | null>(null);

  const areasQuery = useQuery<Area[]>({
    queryKey: ['areas'],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: () => apiFetch<Area[]>('/api/v1/areas'),
  });

  const projectsQuery = useQuery<Project[]>({
    queryKey: ['projects', 'all'],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: () => apiFetch<Project[]>('/api/v1/projects'),
  });

  const dashboardQuery = useQuery<HabitsDashboardPayload>({
    queryKey: ['habits', 'dashboard', filters.areaId, filters.projectId, filters.includeSub ? 1 : 0],
    queryFn: () => {
      const query = buildQuery({
        area_id: filters.areaId || undefined,
        project_id: filters.projectId || undefined,
        include_sub: filters.includeSub && filters.areaId ? 1 : undefined,
      });
      return apiFetch<HabitsDashboardPayload>(`/api/v1/habits/dashboard${query}`);
    },
    staleTime: 15_000,
    gcTime: 120_000,
    retry: (failureCount, error) => {
      if (isTelegramRequired(error)) {
        return false;
      }
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });

  useEffect(() => {
    if (dashboardQuery.error) {
      if (isTelegramRequired(dashboardQuery.error)) {
        setRequiresTelegram(true);
      } else if (dashboardQuery.error instanceof ApiError && dashboardQuery.error.status === 401) {
        setActionMessage('Нужна авторизация: войдите, чтобы работать с привычками.');
      } else {
        setActionMessage('Не удалось загрузить данные панели привычек.');
      }
    }
  }, [dashboardQuery.error]);

  const areaOptions = useMemo(() => buildAreaOptions(areasQuery.data ?? []), [areasQuery.data]);

  const areaById = useMemo(() => {
    const map = new Map<number, Area>();
    (areasQuery.data ?? []).forEach((area) => map.set(area.id, area));
    return map;
  }, [areasQuery.data]);

  const projectById = useMemo(() => {
    const map = new Map<number, Project>();
    (projectsQuery.data ?? []).forEach((project) => map.set(project.id, project));
    return map;
  }, [projectsQuery.data]);

  const projectsByArea = useMemo(() => {
    const result = new Map<number, Project[]>();
    (projectsQuery.data ?? []).forEach((project) => {
      const list = result.get(project.area_id);
      if (list) {
        list.push(project);
      } else {
        result.set(project.area_id, [project]);
      }
    });
    return result;
  }, [projectsQuery.data]);

  const filteredHabits = useMemo(() => dashboardQuery.data?.habits ?? [], [dashboardQuery.data?.habits]);

  const dashboardDailies = useMemo(() => dashboardQuery.data?.dailies ?? [], [dashboardQuery.data?.dailies]);

  const dashboardRewards = useMemo(() => dashboardQuery.data?.rewards ?? [], [dashboardQuery.data?.rewards]);

  const filteredProjects = useMemo(() => {
    if (!form.areaId) {
      return [] as Project[];
    }
    const id = Number(form.areaId);
    return projectsByArea.get(id) ?? [];
  }, [form.areaId, projectsByArea]);

  const filterProjects = useMemo(() => {
    if (filters.areaId) {
      return projectsByArea.get(Number(filters.areaId)) ?? [];
    }
    return projectsQuery.data ?? [];
  }, [filters.areaId, projectsByArea, projectsQuery.data]);

  const stats = dashboardQuery.data?.stats;

  const handleFormChange = (field: keyof HabitFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value;
    setForm((prev) => {
      if (field === 'areaId') {
        return { ...prev, areaId: value, projectId: '' };
      }
      return { ...prev, [field]: value };
    });
  };

  const createMutation = useMutation({
    mutationFn: async (payload: HabitCreatePayload) => {
      return apiFetch<{ id: number }>('/api/v1/habits', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setForm((prev) => ({ ...prev, name: '' }));
      setFormError(null);
      setActionMessage('Привычка создана.');
      queryClient.invalidateQueries({ queryKey: ['habits', 'dashboard'] });
    },
    onError: (error: unknown) => {
      if (isTelegramRequired(error)) {
        setRequiresTelegram(true);
        setFormError('Для создания привычек свяжите Telegram в настройках.');
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 400) {
          setFormError('Укажите область или проект для привязки привычки.');
          return;
        }
        if (error.status === 401) {
          setFormError('Нужна авторизация.');
          return;
        }
        setFormError(error.message);
        return;
      }
      setFormError('Не удалось создать привычку.');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (habitId: number) => {
      return apiFetch(`/api/v1/habits/${habitId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ date: todayISO() }),
      });
    },
    onMutate: (habitId: number) => {
      setPendingAction({ type: 'toggle', habitId });
    },
    onSuccess: () => {
      setActionMessage('Привычка обновлена.');
      queryClient.invalidateQueries({ queryKey: ['habits', 'dashboard'] });
    },
    onError: (error) => {
      if (isTelegramRequired(error)) {
        setRequiresTelegram(true);
        setActionMessage('Для отметки выполнения привяжите Telegram аккаунт.');
      } else {
        const cooldown = describeCooldown(error);
        setActionMessage(cooldown ?? 'Не удалось обновить привычку.');
      }
    },
    onSettled: () => {
      setPendingAction(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (habitId: number) => {
      return apiFetch(`/api/v1/habits/${habitId}`, {
        method: 'DELETE',
      });
    },
    onMutate: (habitId: number) => {
      setPendingAction({ type: 'delete', habitId });
    },
    onSuccess: () => {
      setActionMessage('Привычка удалена.');
      queryClient.invalidateQueries({ queryKey: ['habits', 'dashboard'] });
    },
    onError: (error) => {
      if (isTelegramRequired(error)) {
        setRequiresTelegram(true);
        setActionMessage('Для удаления привяжите Telegram аккаунт.');
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        setActionMessage('Нужна авторизация.');
      } else {
        setActionMessage('Не удалось удалить привычку.');
      }
    },
    onSettled: () => {
      setPendingAction(null);
    },
  });

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFormError('Добавьте название привычки.');
      return;
    }
    const payload: HabitCreatePayload = {
      name,
      frequency: form.frequency,
    };
    if (form.projectId) {
      payload.project_id = Number(form.projectId);
    }
    if (!payload.project_id && form.areaId) {
      payload.area_id = Number(form.areaId);
    }
    if (!payload.project_id && !payload.area_id) {
      setFormError('Выберите область или проект.');
      return;
    }
    createMutation.mutate(payload);
  };

  const handleFilterAreaChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFilters((prev) => ({ areaId: value, projectId: '', includeSub: value ? prev.includeSub : false }));
  };

  const handleFilterProjectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFilters((prev) => ({ ...prev, projectId: value }));
  };

  const handleIncludeSubChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setFilters((prev) => ({ ...prev, includeSub: checked }));
  };

  const handleToggle = (habitId: number) => {
    toggleMutation.mutate(habitId);
  };

  const handleDelete = (habitId: number) => {
    const habitTitle = resolveHabitTitle(
      dashboardQuery.data?.habits.find((h) => h.id === habitId) ?? { title: 'Привычка' },
    );
    const confirmed = window.confirm(`Удалить привычку «${habitTitle}»?`);
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(habitId);
  };

  const renderHabits = () => {
    if (dashboardQuery.isLoading) {
      return <p className="text-sm text-muted">Загружаем привычки…</p>;
    }
    if (dashboardQuery.isError && !requiresTelegram) {
      return <p className="text-sm text-muted">Не удалось загрузить привычки.</p>;
    }
    if (requiresTelegram) {
      return (
        <EmptyState
          title="Свяжите Telegram"
          description="Чтобы отслеживать привычки и получать награды, подключите Telegram-аккаунт в настройках."
          action={
            <Button variant="primary" onClick={() => router.push('/settings#telegram-linking')}>
              Открыть настройки
            </Button>
          }
        />
      );
    }
    if (filteredHabits.length === 0) {
      return (
        <EmptyState
          title="Пока нет привычек"
          description="Создайте первую привычку или примените другой фильтр по области."
        />
      );
    }
    return (
      <div className="flex flex-col gap-4">
        {filteredHabits.map((habit) => {
          const { percent, todayDone } = computeProgressStats(habit.progress ?? []);
          const area = habit.area_id ? areaById.get(habit.area_id) : undefined;
          const project = habit.project_id ? projectById.get(habit.project_id) : undefined;
          const deleting = pendingAction?.type === 'delete' && pendingAction.habitId === habit.id && deleteMutation.isPending;
          const toggling = pendingAction?.type === 'toggle' && pendingAction.habitId === habit.id && toggleMutation.isPending;
          return (
            <Card key={habit.id} as="article" padded surface="soft" className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">{resolveHabitTitle(habit)}</h3>
                    <Badge tone="accent" size="sm">
                      {getFrequencyLabel(habit.frequency)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted">
                    {formatAreaLabel(area?.name, project?.name)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(habit.id)}
                  disabled={deleting}
                  aria-label={`Удалить привычку «${resolveHabitTitle(habit)}»`}
                >
                  Удалить
                </Button>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Прогресс 30 дней</span>
                  <span>{percent}%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-soft" aria-hidden>
                  <div
                    className="h-full rounded-full bg-[var(--accent-primary)] transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {todayDone ? 'Сегодня привычка уже отмечена.' : 'Сегодня пока не отмечено.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant={todayDone ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => handleToggle(habit.id)}
                  disabled={toggling}
                >
                  {todayDone ? 'Сбросить' : 'Отметить'}
                </Button>
                {toggling ? <span className="text-xs text-muted">Сохраняем…</span> : null}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderDailies = () => {
    if (dashboardQuery.isLoading) {
      return <p className="text-sm text-muted">Загружаем ежедневки…</p>;
    }
    if (requiresTelegram) {
      return (
        <EmptyState
          title="Свяжите Telegram"
          description="Чтобы отмечать ежедневки, подключите Telegram-аккаунт в настройках."
          action={
            <Button variant="primary" onClick={() => router.push('/settings#telegram-linking')}>
              Открыть настройки
            </Button>
          }
        />
      );
    }
    if (dashboardDailies.length === 0) {
      return (
        <EmptyState
          title="Ежедневки не найдены"
          description="Создайте ежедневку в клиенте или через Telegram-бота, чтобы отслеживать рутину."
        />
      );
    }
    return (
      <div className="flex flex-col gap-3">
        {dashboardDailies.map((daily) => {
          const area = daily.area_id ? areaById.get(daily.area_id) : undefined;
          const project = daily.project_id ? projectById.get(daily.project_id) : undefined;
          return (
            <Card key={daily.id} padded surface="soft" className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{daily.title}</h3>
                  <span className="text-xs text-muted">{formatAreaLabel(area?.name, project?.name)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {daily.frozen ? <Badge tone="neutral" size="sm">Пауза</Badge> : null}
                  {daily.difficulty ? (
                    <Badge tone="accent" size="sm">
                      {daily.difficulty}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Серия: {daily.streak}</span>
                <span>{daily.rrule}</span>
              </div>
              {daily.note ? <p className="text-xs text-muted">{daily.note}</p> : null}
            </Card>
          );
        })}
      </div>
    );
  };

  const renderRewards = () => {
    if (dashboardQuery.isLoading) {
      return <p className="text-sm text-muted">Загружаем награды…</p>;
    }
    if (requiresTelegram) {
      return (
        <EmptyState
          title="Свяжите Telegram"
          description="Чтобы покупать награды, подключите Telegram-аккаунт в настройках."
          action={
            <Button variant="primary" onClick={() => router.push('/settings#telegram-linking')}>
              Открыть настройки
            </Button>
          }
        />
      );
    }
    if (dashboardRewards.length === 0) {
      return (
        <EmptyState
          title="Награды пока не настроены"
          description="Добавьте награду через приложение или Telegram-бота, чтобы тратить золото."
        />
      );
    }
    return (
      <div className="flex flex-col gap-3">
        {dashboardRewards.map((reward) => {
          const area = reward.area_id ? areaById.get(reward.area_id) : undefined;
          const project = reward.project_id ? projectById.get(reward.project_id) : undefined;
          return (
            <Card key={reward.id} padded surface="soft" className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{reward.title}</h3>
                  <span className="text-xs text-muted">{formatAreaLabel(area?.name, project?.name)}</span>
                </div>
                <Badge tone="warning" size="sm">
                  {reward.cost_gold} золота
                </Badge>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION} contentClassName="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        {actionMessage ? (
          <Card surface="soft" padded className="text-sm text-muted">
            {actionMessage}
          </Card>
        ) : null}
        <Card className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" padded>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Уровень</span>
            <span className="text-2xl font-semibold text-[var(--text-primary)]">
              {stats ? stats.level : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Опыт / день</span>
            <span className="text-lg font-semibold text-[var(--text-primary)]">
              {stats ? `${stats.xp} XP · +${stats.daily_xp}` : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Золото</span>
            <span className="text-lg font-semibold text-[var(--text-primary)]">
              {stats ? `${stats.gold} G · +${stats.daily_gold}` : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Здоровье</span>
            <span className="text-lg font-semibold text-[var(--text-primary)]">
              {stats ? `${stats.hp} HP` : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Карма</span>
            <span className="text-lg font-semibold text-[var(--text-primary)]">
              {stats ? `${stats.kp} KP` : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Следующий шаг</span>
            <span className="text-sm text-muted">
              Фокус на стабильности: отметьте ключевые привычки и переходите к ежедневкам.
            </span>
          </div>
        </Card>
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <Card as="section" padded className="flex flex-col gap-6" aria-labelledby="habits-heading">
            <header className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h2 id="habits-heading" className="text-lg font-semibold text-[var(--text-primary)]">
                  Активные привычки
                </h2>
                <p className="text-sm text-muted">
                  Просматривайте привычки, ежедневки и награды в одном месте. Используйте фильтры, чтобы сфокусироваться на нужной области или проекте.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <Field label="Фильтр по области" className="w-48">
                  <Select value={filters.areaId} onChange={handleFilterAreaChange} aria-label="Фильтр по области">
                    <option value="">Все области</option>
                    {areaOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Фильтр по проекту" className="w-48">
                  <Select
                    value={filters.projectId}
                    onChange={handleFilterProjectChange}
                    aria-label="Фильтр по проекту"
                    disabled={filterProjects.length === 0}
                  >
                    <option value="">Все проекты</option>
                    {filterProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Поддерево" className="md:w-auto">
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <Checkbox checked={filters.includeSub} onChange={handleIncludeSubChange} disabled={!filters.areaId} />
                    <span>Включить поддерево</span>
                  </label>
                </Field>
              </div>
              <form onSubmit={handleCreateSubmit} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                <Field label="Новая привычка" className="md:col-span-1">
                  <Input
                    name="name"
                    placeholder="Например, Утренняя зарядка"
                    value={form.name}
                    onChange={handleFormChange('name')}
                    required
                  />
                </Field>
                <Field label="Частота">
                  <Select value={form.frequency} onChange={handleFormChange('frequency')} aria-label="Частота привычки">
                    <option value="daily">Ежедневно</option>
                    <option value="weekly">Еженедельно</option>
                    <option value="monthly">Ежемесячно</option>
                  </Select>
                </Field>
                <Field label="Область" className="md:w-48">
                  <Select value={form.areaId} onChange={handleFormChange('areaId')} aria-label="Область привычки">
                    <option value="">Выберите область</option>
                    {areaOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Проект" className="md:w-56">
                  <Select value={form.projectId} onChange={handleFormChange('projectId')} aria-label="Проект привычки">
                    <option value="">Без проекта</option>
                    {filteredProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="md:justify-self-end">
                  <Button type="submit" variant="primary" size="md" disabled={createMutation.isPending}>
                    Создать
                  </Button>
                </div>
              </form>
              {formError ? <p className="text-sm text-red-500">{formError}</p> : null}
            </header>
            {renderHabits()}
          </Card>
          <div className="flex flex-col gap-4">
            <Card padded surface="soft" className="flex flex-col gap-4" aria-labelledby="dailies-heading">
              <div className="flex items-center justify-between gap-2">
                <h3 id="dailies-heading" className="text-base font-semibold text-[var(--text-primary)]">
                  Ежедневки
                </h3>
                <Badge tone="neutral" size="sm">
                  Рутину вперёд
                </Badge>
              </div>
              {renderDailies()}
            </Card>
            <Card padded surface="soft" className="flex flex-col gap-4" aria-labelledby="rewards-heading">
              <div className="flex items-center justify-between gap-2">
                <h3 id="rewards-heading" className="text-base font-semibold text-[var(--text-primary)]">
                  Награды
                </h3>
                <Badge tone="success" size="sm">
                  Мотивация
                </Badge>
              </div>
              {renderRewards()}
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
