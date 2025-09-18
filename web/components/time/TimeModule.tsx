'use client';

import clsx from 'clsx';
import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import PageLayout from '../PageLayout';
import { Button, Card, EmptyState, Field, Input, Select, Section } from '../ui';
import { apiFetch, ApiError, buildQuery } from '../../lib/api';
import type {
  Area,
  Project,
  TimeEntry,
  TimeSummaryArea,
  TimeSummaryDay,
  TimeSummaryProject,
} from '../../lib/types';
import { formatClock, formatDateTime, formatMinutes, parseDateToUtc } from '../../lib/time';

const MODULE_TITLE = 'Учёт времени';
const MODULE_DESCRIPTION =
  'Запускайте таймеры, отслеживайте ритм работы и получайте аналитику по дням, областям и проектам. Командные тарифы видят вклад всей команды.';

const RANGE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 7, label: 'Последние 7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
];

const QUICK_PRESETS: Array<{ label: string; description: string }> = [
  { label: 'Фокус 25 минут', description: 'Фокус-сессия 25 минут' },
  { label: 'Стратегия / планирование', description: 'Планирование недели' },
  { label: 'Командный созвон', description: 'Командный созвон' },
];

interface TimerFormState {
  description: string;
  taskId: string;
}

function getDurationSeconds(entry: TimeEntry, now: number): number {
  let total = entry.active_seconds ?? entry.elapsed_seconds ?? 0;

  const toMillis = (value?: string | null): number | null => {
    const parsed = parseDateToUtc(value);
    if (!parsed) {
      return null;
    }
    const timestamp = parsed.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  };

  const lastSegmentStart = toMillis(entry.last_started_at);
  const startTime = toMillis(entry.start_time);
  const endTime = toMillis(entry.end_time);

  if (entry.is_running && lastSegmentStart != null) {
    total += Math.max(0, Math.round((now - lastSegmentStart) / 1000));
  } else if (!entry.is_running && entry.last_started_at && lastSegmentStart != null && total === 0) {
    total = Math.max(0, Math.round((now - lastSegmentStart) / 1000));
  } else if (endTime != null && startTime != null && total === 0) {
    total = Math.max(0, Math.round((endTime - startTime) / 1000));
  }
  return total;
}

function formatDayLabel(dayIso: string): string {
  try {
    const date = new Date(dayIso);
    return new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  } catch (error) {
    return dayIso;
  }
}

export default function TimeModule(): JSX.Element {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [rangeDays, setRangeDays] = useState<number>(RANGE_OPTIONS[0].value);
  const [timerForm, setTimerForm] = useState<TimerFormState>({ description: '', taskId: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const timeWindow = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (rangeDays - 1));
    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }, [rangeDays]);

  const runningQuery = useQuery<TimeEntry | null, ApiError>({
    queryKey: ['time', 'running'],
    queryFn: () => apiFetch<TimeEntry | null>('/api/v1/time/running'),
    staleTime: 5_000,
    gcTime: 60_000,
    retry: (failureCount, error) => error.status >= 500 && failureCount < 2,
  });

  const entriesQuery = useQuery<TimeEntry[], ApiError>({
    queryKey: ['time', 'entries', rangeDays, timeWindow.from],
    queryFn: () =>
      apiFetch<TimeEntry[]>(
        `/api/v1/time${buildQuery({ date_from: timeWindow.from, date_to: timeWindow.to })}`,
      ),
    staleTime: 10_000,
    gcTime: 60_000,
    retry: (failureCount, error) => error.status >= 500 && failureCount < 2,
  });

  const daySummaryQuery = useQuery<TimeSummaryDay[], ApiError>({
    queryKey: ['time', 'summary', 'day'],
    queryFn: () => apiFetch<TimeSummaryDay[]>('/api/v1/time/summary?group_by=day'),
    staleTime: 30_000,
    gcTime: 120_000,
    retry: (failureCount, error) => error.status >= 500 && failureCount < 2,
  });

  const areaSummaryQuery = useQuery<TimeSummaryArea[], ApiError>({
    queryKey: ['time', 'summary', 'area'],
    queryFn: () => apiFetch<TimeSummaryArea[]>('/api/v1/time/summary?group_by=area'),
    staleTime: 30_000,
    gcTime: 120_000,
    retry: (failureCount, error) => error.status >= 500 && failureCount < 2,
  });

  const projectSummaryQuery = useQuery<TimeSummaryProject[], ApiError>({
    queryKey: ['time', 'summary', 'project'],
    queryFn: () => apiFetch<TimeSummaryProject[]>('/api/v1/time/summary?group_by=project'),
    staleTime: 30_000,
    gcTime: 120_000,
    retry: (failureCount, error) => error.status >= 500 && failureCount < 2,
  });

  const areasQuery = useQuery<Area[], ApiError>({
    queryKey: ['areas'],
    queryFn: () => apiFetch<Area[]>('/api/v1/areas'),
    staleTime: 60_000,
    gcTime: 300_000,
    retry: (failureCount, error) => error.status >= 500 && failureCount < 2,
  });

  const projectsQuery = useQuery<Project[], ApiError>({
    queryKey: ['projects', 'time'],
    queryFn: () => apiFetch<Project[]>('/api/v1/projects'),
    staleTime: 60_000,
    gcTime: 300_000,
    retry: (failureCount, error) => error.status >= 500 && failureCount < 2,
  });

  const isUnauthorized = [runningQuery, entriesQuery].some(
    (query) => query.error instanceof ApiError && query.error.status === 401,
  );

  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data]);

  const durations = useMemo(() => {
    return entries.map((entry) => ({
      entry,
      seconds: getDurationSeconds(entry, nowTick),
    }));
  }, [entries, nowTick]);

  const totalTrackedSeconds = useMemo(
    () => durations.reduce((acc, item) => acc + item.seconds, 0),
    [durations],
  );

  const averageSessionSeconds = useMemo(() => {
    const finished = durations.filter((item) => item.entry.end_time);
    if (finished.length === 0) {
      return 0;
    }
    return Math.round(
      finished.reduce((acc, item) => acc + item.seconds, 0) / Math.max(1, finished.length),
    );
  }, [durations]);

  const filteredDaySummary = useMemo(() => {
    const fromDate = new Date(timeWindow.from.split('T')[0] ?? timeWindow.from);
    return (daySummaryQuery.data ?? [])
      .filter((item) => {
        const parsed = new Date(item.day);
        if (Number.isNaN(parsed.getTime())) {
          return false;
        }
        return parsed >= fromDate;
      })
      .sort((a, b) => b.total_seconds - a.total_seconds);
  }, [daySummaryQuery.data, timeWindow.from]);

  const peakDay = filteredDaySummary[0];

  const areaMap = useMemo(() => {
    const map = new Map<number, Area>();
    (areasQuery.data ?? []).forEach((area) => map.set(area.id, area));
    return map;
  }, [areasQuery.data]);

  const areaBreakdown = useMemo(() => {
    return (areaSummaryQuery.data ?? [])
      .filter((item) => item.area_id != null)
      .map((item) => {
        const area = item.area_id ? areaMap.get(item.area_id) : null;
        return {
          id: item.area_id ?? 0,
          name: area?.name ?? `Область #${item.area_id}`,
          seconds: item.total_seconds,
        };
      })
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5);
  }, [areaSummaryQuery.data, areaMap]);

  const totalAreaSeconds = areaBreakdown.reduce((acc, item) => acc + item.seconds, 0);
  const topAreaShare = totalAreaSeconds > 0 ? Math.round((areaBreakdown[0]?.seconds ?? 0) * 100 / totalAreaSeconds) : 0;

  const projectMap = useMemo(() => {
    const map = new Map<number, Project>();
    (projectsQuery.data ?? []).forEach((project) => map.set(project.id, project));
    return map;
  }, [projectsQuery.data]);

  const projectLeaderboard = useMemo(() => {
    return (projectSummaryQuery.data ?? [])
      .filter((item) => item.project_id != null)
      .map((item) => {
        const project = item.project_id ? projectMap.get(item.project_id) : null;
        return {
          id: item.project_id ?? 0,
          name: project?.name ?? `Проект #${item.project_id}`,
          seconds: item.total_seconds,
        };
      })
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5);
  }, [projectSummaryQuery.data, projectMap]);

  const timeline = useMemo(() => {
    return durations
      .slice()
      .sort((a, b) => new Date(b.entry.start_time).getTime() - new Date(a.entry.start_time).getTime())
      .slice(0, 10);
  }, [durations]);

  const runningEntryRaw = runningQuery.data ?? null;
  const activeEntry = runningEntryRaw && !runningEntryRaw.end_time ? runningEntryRaw : null;
  const isTimerRunning = Boolean(activeEntry?.is_running);
  const isTimerPaused = Boolean(activeEntry?.is_paused && !activeEntry?.is_running);
  const activeEntrySeconds = activeEntry ? getDurationSeconds(activeEntry, nowTick) : 0;

  const startMutation = useMutation({
    mutationFn: (payload: { description: string | null; task_id: number | null }) =>
      apiFetch<TimeEntry>('/api/v1/time/start', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setTimerForm({ description: '', taskId: '' });
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['time'] });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        setFormError(error.message);
        return;
      }
      setFormError('Не удалось запустить таймер');
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (entryId: number) =>
      apiFetch<TimeEntry>(`/api/v1/time/${entryId}/pause`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time'] });
    },
  });

  const resumeEntryMutation = useMutation({
    mutationFn: (entryId: number) =>
      apiFetch<TimeEntry>(`/api/v1/time/${entryId}/resume`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time'] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: (entryId: number) =>
      apiFetch<TimeEntry>(`/api/v1/time/${entryId}/stop`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time'] });
    },
  });

  const handleStart = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      description: timerForm.description ? timerForm.description.trim() : null,
      task_id: timerForm.taskId ? Number(timerForm.taskId) : null,
    };
    startMutation.mutate(payload);
  };

  const handleQuickStart = (description: string) => {
    startMutation.mutate({ description, task_id: null });
  };

  const handlePause = () => {
    if (!activeEntry) {
      return;
    }
    pauseMutation.mutate(activeEntry.id);
  };

  const handleResume = () => {
    if (!activeEntry) {
      return;
    }
    resumeEntryMutation.mutate(activeEntry.id);
  };

  const handleStop = () => {
    if (!activeEntry) {
      return;
    }
    stopMutation.mutate(activeEntry.id);
  };

  const handleRangeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setRangeDays(Number(event.target.value));
  };

  if (isUnauthorized) {
    return (
      <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION}>
        <Card className="max-w-xl">
          <EmptyState
            title="Нужна авторизация"
            description="Войдите и привяжите Telegram-аккаунт, чтобы запускать таймеры и видеть аналитику."
          />
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION}>
      <section className="flex flex-col gap-6">
        <div className="cards-grid">
          <Card data-widget="time-active" className="relative overflow-hidden">
            <Section className="gap-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Текущий фокус</h3>
                  <p className="text-sm text-muted">
                    Минимум кликов и крупные элементы управления по рекомендациям Toggl Track и Clockify делают трекинг
                    непрерывным.
                  </p>
                </div>
                <Select value={rangeDays} onChange={handleRangeChange} className="w-full sm:w-48">
                  {RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              {activeEntry ? (
                <div className="relative overflow-hidden rounded-2xl border border-dashed border-[var(--accent-primary)] bg-gradient-to-br from-[color-mix(in srgb, var(--accent-primary) 18%, transparent)] via-[color-mix(in srgb, var(--accent-primary) 8%, transparent)] to-transparent p-6">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-1 items-start gap-5">
                      <button
                        type="button"
                        className={clsx(
                          'inline-flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]',
                          isTimerRunning
                            ? 'bg-emerald-500 hover:bg-emerald-400 focus-visible:ring-emerald-500'
                            : 'bg-amber-500 hover:bg-amber-400 focus-visible:ring-amber-500',
                          (pauseMutation.isPending || resumeEntryMutation.isPending) && 'opacity-70',
                        )}
                        onClick={isTimerRunning ? handlePause : handleResume}
                        disabled={pauseMutation.isPending || resumeEntryMutation.isPending}
                        title={isTimerRunning ? 'Пауза' : 'Продолжить'}
                        aria-label={isTimerRunning ? 'Пауза' : 'Продолжить'}
                      >
                        {pauseMutation.isPending || resumeEntryMutation.isPending ? <LoaderIcon /> : isTimerRunning ? <PauseIcon /> : <PlayIcon />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Таймер</span>
                          <span className="relative inline-flex h-2.5 w-2.5">
                            <span
                              aria-hidden
                              className={clsx(
                                'absolute inset-0 rounded-full transition-colors duration-200',
                                isTimerRunning ? 'bg-emerald-500' : 'bg-amber-500',
                              )}
                            />
                            <span className="sr-only">{isTimerRunning ? 'Таймер активен' : 'Таймер на паузе'}</span>
                          </span>
                        </div>
                        <div className="mt-2 font-mono text-4xl font-semibold tracking-tight text-[var(--text-primary)] lg:text-5xl">
                          {formatClock(activeEntrySeconds)}
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {isTimerRunning
                            ? `Запущен ${formatDateTime(activeEntry.start_time)}`
                            : `Пауза с ${formatDateTime(activeEntry.paused_at ?? activeEntry.start_time)}`}
                        </p>
                        {activeEntry.description ? (
                          <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-2">
                            {activeEntry.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 lg:flex-col lg:items-end lg:justify-between">
                      <Button
                        onClick={handleStop}
                        disabled={stopMutation.isPending}
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:bg-red-500/10 focus-visible:ring-red-500 dark:text-red-400"
                        aria-label="Завершить сессию"
                        title="Завершить сессию"
                      >
                        {stopMutation.isPending ? <LoaderIcon /> : <StopIcon />}
                      </Button>
                      {activeEntry.task_id ? (
                        <Button
                          onClick={() => router.push(`/tasks?task=${activeEntry.task_id}`)}
                          variant="ghost"
                          size="icon"
                          aria-label={`Открыть задачу #${activeEntry.task_id}`}
                          title={`Открыть задачу #${activeEntry.task_id}`}
                        >
                          <TaskIcon />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                  <form onSubmit={handleStart} className="flex flex-col gap-4 rounded-2xl border border-subtle bg-[var(--surface-0)] p-6 shadow-soft">
                    <Field label="Что фиксируем">
                      <Input
                        name="description"
                        placeholder="Например, созвон с клиентом"
                        value={timerForm.description}
                        onChange={(event) => setTimerForm((prev) => ({ ...prev, description: event.target.value }))}
                      />
                    </Field>
                    <Field label="ID задачи (необязательно)">
                      <Input
                        name="task_id"
                        type="number"
                        min={1}
                        placeholder="123"
                        value={timerForm.taskId}
                        onChange={(event) => setTimerForm((prev) => ({ ...prev, taskId: event.target.value }))}
                      />
                    </Field>
                    {formError ? <p className="text-sm text-danger">{formError}</p> : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="submit" disabled={startMutation.isPending} variant="primary">
                        Запустить таймер
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => router.push('/time')}>
                        Открыть журнал
                      </Button>
                    </div>
                  </form>
                  <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-subtle bg-surface-soft p-6 shadow-soft">
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">Быстрый старт</h4>
                      <p className="mt-1 text-xs text-muted">
                        Предустановленные сценарии — популярный паттерн профессиональных тайм-трекеров. Один тап, и
                        таймер уже считает фокус.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_PRESETS.map((preset) => (
                        <Button
                          key={preset.label}
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => handleQuickStart(preset.description)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Section>
          </Card>

          <Card data-widget="time-metrics">
            <Section className="gap-4">
              <div>
                <h3 className="text-lg font-semibold">Личный прогресс</h3>
                <p className="text-sm text-muted">
                  Аналитика за выбранный период помогает планировать фокус и ритм.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[var(--surface-soft)] p-4">
                  <div className="text-xs uppercase tracking-wide text-muted">Всего за период</div>
                  <div className="text-2xl font-semibold">{formatMinutes(totalTrackedSeconds / 60)}</div>
                </div>
                <div className="rounded-xl bg-[var(--surface-soft)] p-4">
                  <div className="text-xs uppercase tracking-wide text-muted">Средняя сессия</div>
                  <div className="text-2xl font-semibold">
                    {averageSessionSeconds > 0 ? formatMinutes(averageSessionSeconds / 60) : '—'}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm text-muted">
                  <span>Динамика по дням</span>
                  <span>Лучший день: {peakDay ? formatDayLabel(peakDay.day) : '—'}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {filteredDaySummary.length === 0 ? (
                    <p className="text-sm text-muted">Пока нет зафиксированного времени за выбранный период.</p>
                  ) : (
                    filteredDaySummary.slice(0, 7).map((item) => {
                      const width = totalTrackedSeconds > 0 ? Math.floor((item.total_seconds * 100) / totalTrackedSeconds) : 0;
                      return (
                        <div key={item.day} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs text-muted">
                            <span>{formatDayLabel(item.day)}</span>
                            <span>{formatMinutes(item.total_seconds / 60)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full bg-[var(--accent-primary)] transition-all"
                              style={{ width: `${Math.max(6, width)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </Section>
          </Card>

          <Card data-widget="time-team">
            <Section className="gap-4">
              <div>
                <h3 className="text-lg font-semibold">Командная синхронизация</h3>
                <p className="text-sm text-muted">
                  Отслеживайте, куда уходит время команды и какие проекты требуют внимания.
                </p>
              </div>
              {projectLeaderboard.length === 0 ? (
                <EmptyState
                  title="Недостаточно данных"
                  description="Как только вы и коллеги начнёте фиксировать время по задачам, здесь появится рейтинг проектов."
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {projectLeaderboard.map((project, index) => {
                    const percent = project.seconds > 0 && totalTrackedSeconds > 0 ? Math.round((project.seconds * 100) / totalTrackedSeconds) : null;
                    return (
                      <div key={project.id} className="flex flex-col gap-1 rounded-xl bg-[var(--surface-soft)] p-3">
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span>
                            #{index + 1} · {project.name}
                          </span>
                          <span>{formatMinutes(project.seconds / 60)}</span>
                        </div>
                        {percent !== null ? (
                          <div className="text-xs text-muted">{percent}% от вашего трека за период</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted">
                Командные тарифы видят распределение по участникам и могут делиться отчётами с клиентами.
              </p>
            </Section>
          </Card>
        </div>

        <Card data-widget="time-areas">
          <Section className="gap-4">
            <div>
              <h3 className="text-lg font-semibold">Контекст по областям</h3>
              <p className="text-sm text-muted">
                Помогает балансировать портфель проектов: лидирующая область занимает {topAreaShare || 0}% от общего времени.
              </p>
            </div>
            {areaBreakdown.length === 0 ? (
              <EmptyState
                title="Нет данных по областям"
                description="Свяжите задачи и время с областями PARA, чтобы видеть распределение фокуса."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {areaBreakdown.map((area) => (
                  <div key={area.id} className="rounded-xl border border-subtle p-4">
                    <div className="text-sm font-medium">{area.name}</div>
                    <div className="text-xs text-muted">{formatMinutes(area.seconds / 60)}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </Card>

        <Card data-widget="time-timeline">
          <Section className="gap-4">
            <div>
              <h3 className="text-lg font-semibold">Хронология сессий</h3>
              <p className="text-sm text-muted">
                Последние записи помогают быстро вспомнить контекст и продолжить работу.
              </p>
            </div>
            {timeline.length === 0 ? (
              <EmptyState
                title="История пока пустая"
                description="Создайте первую запись или импортируйте данные из ботов и интеграций."
              />
            ) : (
              <div className="flex flex-col divide-y divide-subtle rounded-xl border border-subtle">
                {timeline.map(({ entry, seconds }) => (
                  <div key={entry.id} className="flex flex-col gap-1 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
                      <span>{entry.description || 'Без описания'}</span>
                      <span className="text-muted">{formatMinutes(seconds / 60)}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {formatDateTime(entry.start_time)}
                      {entry.end_time ? ` · завершено ${formatDateTime(entry.end_time)}` : ' · в процессе'}
                      {entry.task_id ? ` · задача #${entry.task_id}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </Card>

        <Card data-widget="time-automation">
          <Section className="gap-4">
            <div>
              <h3 className="text-lg font-semibold">Автоматизация и интеграции</h3>
              <p className="text-sm text-muted">
                Подключите календари, таск-трекеры и чат-ботов — новые записи будут создаваться автоматически, а отчёты обновляться в реальном времени.
              </p>
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
              <li className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm">
                <div className="font-medium">Автоподсказки задач</div>
                <p className="text-muted">
                  Таймер предлагает задачи на основе последних действий и календаря.
                </p>
              </li>
              <li className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm">
                <div className="font-medium">Синхронизация c календарём</div>
                <p className="text-muted">
                  Импортируйте события, чтобы фиксировать реальные встречи и фокус-блоки.
                </p>
              </li>
              <li className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm">
                <div className="font-medium">Экспорт для клиентов</div>
                <p className="text-muted">
                  Делитесь детальными отчётами и прогнозами нагрузки команды.
                </p>
              </li>
              <li className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm">
                <div className="font-medium">Боты и мобильные виджеты</div>
                <p className="text-muted">
                  Стартуйте таймер из Telegram или с рабочего стола в один тап.
                </p>
              </li>
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  window.location.assign('/settings');
                }}
              >
                Настроить интеграции
              </Button>
              <span className="text-xs text-muted">
                Поддерживаются Google Calendar, Slack, Telegram-бот и webhooks.
              </span>
            </div>
          </Section>
        </Card>
      </section>
    </PageLayout>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M7 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="7" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" />
      <rect x="13.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}

function TaskIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M9 11l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </svg>
  );
}

function LoaderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 animate-spin" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
    </svg>
  );
}
