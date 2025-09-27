'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import PageLayout from '../PageLayout';
import { Button, Card, Field, Input, Select, Textarea, Toolbar } from '../ui';
import { apiFetch, ApiError, buildQuery } from '../../lib/api';
import type {
  Area,
  CalendarAlarm,
  CalendarEvent,
  CalendarItem,
  Project,
} from '../../lib/types';
import { formatDateTime } from '../../lib/time';
import { cn } from '../../lib/cn';

interface EventCreatePayload {
  title: string;
  start_at: string;
  end_at?: string | null;
  description?: string | null;
}

interface CalendarItemCreatePayload {
  title: string;
  start_at: string;
  end_at?: string | null;
  tzid: string;
  description?: string | null;
  project_id?: number | null;
  area_id?: number | null;
}

type AgendaScope = 'area' | 'project';

interface EventFormState {
  title: string;
  description: string;
  start: string;
  end: string;
}

interface ItemFormState {
  title: string;
  description: string;
  start: string;
  end: string;
  scope: AgendaScope;
  areaId: string;
  projectId: string;
}

const MODULE_TITLE = 'Календарь';
const MODULE_DESCRIPTION =
  'Планируйте события, назначайте контекст через PARA и управляйте напоминаниями в одном интерфейсе.';

const AGENDA_RANGE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 7, label: '7 дней' },
  { value: 14, label: '14 дней' },
  { value: 30, label: '30 дней' },
];

function toLocalInputValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoString(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function isUnauthorizedError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401;
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function formatTimeRange(item: CalendarItem): string {
  const start = formatDateTime(item.start_at);
  const end = item.end_at ? formatDateTime(item.end_at) : null;
  if (end) {
    return `${start} — ${end}`;
  }
  return start;
}

interface CalendarItemCardProps {
  item: CalendarItem;
  areaMap: Map<number, Area>;
  projectMap: Map<number, Project>;
}

function CalendarItemCard({ item, areaMap, projectMap }: CalendarItemCardProps) {
  const [showAlarms, setShowAlarms] = useState(false);
  const area = item.area_id != null ? areaMap.get(item.area_id) : undefined;
  const project = item.project_id != null ? projectMap.get(item.project_id) : undefined;
  const contextLabel = project?.name ?? area?.name ?? 'Без контекста';
  const timeRange = formatTimeRange(item);

  return (
    <Card padded surface="soft" className="flex flex-col gap-3" data-widget="calendar-item">
      <div className="flex flex-col gap-1">
        <div className="text-xs uppercase tracking-wide text-muted">{contextLabel}</div>
        <div className="text-base font-semibold text-[var(--text-primary)]">{item.title}</div>
        <div className="text-sm text-muted">{timeRange}</div>
      </div>
      {item.description ? <p className="text-sm leading-relaxed text-[var(--text-primary)]">{item.description}</p> : null}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {item.tzid ? <span className="rounded-full bg-surface-soft px-3 py-1">{item.tzid}</span> : null}
        {project ? <span className="rounded-full bg-surface-soft px-3 py-1">{project.name}</span> : null}
        {!project && area ? <span className="rounded-full bg-surface-soft px-3 py-1">{area.name}</span> : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowAlarms((value) => !value)}
          aria-expanded={showAlarms}
        >
          {showAlarms ? 'Скрыть напоминания' : 'Показать напоминания'}
        </Button>
      </div>
      <ItemAlarmPanel itemId={item.id} endAt={item.end_at} visible={showAlarms} />
    </Card>
  );
}

interface ItemAlarmPanelProps {
  itemId: number;
  endAt?: string | null;
  visible: boolean;
}

function ItemAlarmPanel({ itemId, endAt, visible }: ItemAlarmPanelProps) {
  const queryClient = useQueryClient();
  const alarmsQuery = useQuery<CalendarAlarm[], ApiError>({
    queryKey: ['calendar', 'alarms', itemId],
    queryFn: () => apiFetch<CalendarAlarm[]>(`/api/v1/calendar/items/${itemId}/alarms`),
    enabled: visible,
    staleTime: 0,
  });

  const [formValue, setFormValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setFormValue('');
      setErrorMessage(null);
    }
  }, [visible]);

  const createAlarmMutation = useMutation({
    mutationFn: async (isoString: string) => {
      return apiFetch<CalendarAlarm>(`/api/v1/calendar/items/${itemId}/alarms`, {
        method: 'POST',
        body: JSON.stringify({ trigger_at: isoString }),
      });
    },
    onSuccess: () => {
      setFormValue('');
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['calendar', 'alarms', itemId] });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Не удалось создать напоминание');
      }
    },
  });

  if (!visible) {
    return null;
  }

  const alarms = alarmsQuery.data ?? [];
  const alarmsLoading = alarmsQuery.isLoading;
  const alarmsError = alarmsQuery.error && !isUnauthorizedError(alarmsQuery.error);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    const iso = toIsoString(formValue);
    if (!iso) {
      setErrorMessage('Укажите корректную дату и время напоминания');
      return;
    }
    const endIso = endAt ? new Date(endAt).getTime() : null;
    if (endIso && new Date(iso).getTime() >= endIso) {
      setErrorMessage('Напоминание должно сработать до окончания события');
      return;
    }
    createAlarmMutation.mutate(iso);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-subtle bg-[var(--surface-0)] p-4">
      <div className="text-sm font-medium text-[var(--text-primary)]">Напоминания</div>
      {alarmsLoading ? <div className="text-sm text-muted">Загружаем…</div> : null}
      {alarmsError ? <div className="text-sm text-red-600">Не удалось загрузить напоминания</div> : null}
      {!alarmsLoading && !alarmsError ? (
        alarms.length ? (
          <ul className="flex flex-col gap-2 text-sm text-[var(--text-primary)]">
            {alarms.map((alarm) => (
              <li key={alarm.id} className="rounded-xl bg-surface-soft px-3 py-2">
                {formatDateTime(alarm.trigger_at)}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted">Пока нет запланированных напоминаний</div>
        )
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Field label="Когда напомнить" required>
          <Input
            type="datetime-local"
            value={formValue}
            min={toLocalInputValue(new Date())}
            onChange={(event) => setFormValue(event.target.value)}
            disabled={createAlarmMutation.isPending}
          />
        </Field>
        {errorMessage ? <div className="text-xs text-red-600">{errorMessage}</div> : null}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={createAlarmMutation.isPending}>
            {createAlarmMutation.isPending ? 'Сохраняем…' : 'Добавить напоминание'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function CalendarModule(): JSX.Element {
  const queryClient = useQueryClient();
  const [clientTimezone, setClientTimezone] = useState('UTC');
  const [agendaDays, setAgendaDays] = useState<number>(AGENDA_RANGE_OPTIONS[1]?.value ?? 14);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        setClientTimezone(tz);
      }
    } catch (error) {
      console.warn('Не удалось определить таймзону клиента', error);
    }
  }, []);

  const initialEventForm: EventFormState = useMemo(
    () => ({
      title: '',
      description: '',
      start: toLocalInputValue(new Date()),
      end: '',
    }),
    [],
  );
  const initialItemForm: ItemFormState = useMemo(
    () => ({
      title: '',
      description: '',
      start: toLocalInputValue(new Date()),
      end: '',
      scope: 'area',
      areaId: '',
      projectId: '',
    }),
    [],
  );

  const [eventForm, setEventForm] = useState<EventFormState>(initialEventForm);
  const [itemForm, setItemForm] = useState<ItemFormState>(initialItemForm);
  const [eventError, setEventError] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);

  const agendaWindow = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + agendaDays);
    to.setHours(23, 59, 59, 999);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }, [agendaDays]);

  const eventsQuery = useQuery<CalendarEvent[], ApiError>({
    queryKey: ['calendar', 'events'],
    queryFn: () => apiFetch<CalendarEvent[]>('/api/v1/calendar'),
    staleTime: 10_000,
    gcTime: 60_000,
    retry: (failureCount, error) => (error instanceof ApiError && error.status >= 500 ? failureCount < 2 : false),
  });

  const agendaQuery = useQuery<CalendarItem[], ApiError>({
    queryKey: ['calendar', 'agenda', agendaWindow.from, agendaWindow.to],
    queryFn: () =>
      apiFetch<CalendarItem[]>(
        `/api/v1/calendar/agenda${buildQuery({ from: agendaWindow.from, to: agendaWindow.to })}`,
      ),
    staleTime: 15_000,
    gcTime: 60_000,
    retry: (failureCount, error) => (error instanceof ApiError && error.status >= 500 ? failureCount < 2 : false),
  });

  const areasQuery = useQuery<Area[], ApiError>({
    queryKey: ['areas'],
    queryFn: () => apiFetch<Area[]>('/api/v1/areas'),
    staleTime: 60_000,
    gcTime: 300_000,
    retry: (failureCount, error) => (error instanceof ApiError && error.status >= 500 ? failureCount < 2 : false),
  });

  const projectsQuery = useQuery<Project[], ApiError>({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/v1/projects'),
    staleTime: 60_000,
    gcTime: 300_000,
    retry: (failureCount, error) => (error instanceof ApiError && error.status >= 500 ? failureCount < 2 : false),
  });

  useEffect(() => {
    if (itemForm.scope === 'area' && !itemForm.areaId && areasQuery.data?.length) {
      setItemForm((prev) => ({ ...prev, areaId: String(areasQuery.data![0].id) }));
    }
  }, [areasQuery.data, itemForm.areaId, itemForm.scope]);

  useEffect(() => {
    if (itemForm.scope === 'project' && !itemForm.projectId && projectsQuery.data?.length) {
      setItemForm((prev) => ({ ...prev, projectId: String(projectsQuery.data![0].id) }));
    }
  }, [projectsQuery.data, itemForm.projectId, itemForm.scope]);

  const createEventMutation = useMutation({
    mutationFn: async (payload: EventCreatePayload) => {
      return apiFetch<CalendarEvent>('/api/v1/calendar', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setEventForm(initialEventForm);
      setEventError(null);
      queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        setEventError(error.message);
      } else {
        setEventError('Не удалось создать событие');
      }
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (payload: CalendarItemCreatePayload) => {
      return apiFetch<CalendarItem>('/api/v1/calendar/items', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setItemForm(initialItemForm);
      setItemError(null);
      queryClient.invalidateQueries({ queryKey: ['calendar', 'agenda'] });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        setItemError(error.message);
      } else {
        setItemError('Не удалось создать запись календаря');
      }
    },
  });

  const areaMap = useMemo(() => {
    const map = new Map<number, Area>();
    (areasQuery.data ?? []).forEach((area) => {
      map.set(area.id, area);
    });
    return map;
  }, [areasQuery.data]);

  const projectMap = useMemo(() => {
    const map = new Map<number, Project>();
    (projectsQuery.data ?? []).forEach((project) => {
      map.set(project.id, project);
    });
    return map;
  }, [projectsQuery.data]);

  const sortedEvents = useMemo(() => {
    const events = [...(eventsQuery.data ?? [])];
    return events.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [eventsQuery.data]);

  const agendaByDay = useMemo(() => {
    const grouped = new Map<string, CalendarItem[]>();
    (agendaQuery.data ?? []).forEach((item) => {
      const date = new Date(item.start_at);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const key = date.toISOString().slice(0, 10);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(item);
    });
    return Array.from(grouped.entries())
      .map(([day, items]) => ({
        day,
        items: items.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
      }))
      .sort((a, b) => (a.day < b.day ? -1 : 1));
  }, [agendaQuery.data]);

  const handleEventSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEventError(null);
    const title = eventForm.title.trim();
    if (!title) {
      setEventError('Добавьте название события');
      return;
    }
    const startIso = toIsoString(eventForm.start);
    if (!startIso) {
      setEventError('Укажите дату и время начала');
      return;
    }
    const endIso = eventForm.end ? toIsoString(eventForm.end) : null;
    const payload: EventCreatePayload = {
      title,
      start_at: startIso,
      end_at: endIso,
      description: eventForm.description.trim() || null,
    };
    createEventMutation.mutate(payload);
  };

  const handleItemSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setItemError(null);
    const title = itemForm.title.trim();
    if (!title) {
      setItemError('Добавьте название записи');
      return;
    }
    const startIso = toIsoString(itemForm.start);
    if (!startIso) {
      setItemError('Укажите дату и время начала');
      return;
    }
    const endIso = itemForm.end ? toIsoString(itemForm.end) : null;

    const payload: CalendarItemCreatePayload = {
      title,
      start_at: startIso,
      end_at: endIso,
      tzid: clientTimezone,
      description: itemForm.description.trim() || null,
      area_id: itemForm.scope === 'area' ? Number(itemForm.areaId) || null : null,
      project_id: itemForm.scope === 'project' ? Number(itemForm.projectId) || null : null,
    };

    if (!payload.area_id && !payload.project_id) {
      setItemError('Выберите область или проект');
      return;
    }

    createItemMutation.mutate(payload);
  };

  const eventsUnauthorized = isUnauthorizedError(eventsQuery.error);
  const agendaUnauthorized = isUnauthorizedError(agendaQuery.error);

  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION} hideContentTitle>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(260px,1fr)]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <Toolbar justify="between">
              <div>
                <div className="text-base font-semibold text-[var(--text-primary)]">Мои события</div>
                <div className="text-xs text-muted">Данные из `/api/v1/calendar`</div>
              </div>
            </Toolbar>
            {eventsQuery.isLoading ? (
              <div className="text-sm text-muted">Загружаем события…</div>
            ) : null}
            {eventsUnauthorized ? (
              <div className="rounded-2xl border border-dashed border-subtle bg-surface-soft p-6 text-sm text-muted">
                Нужен подключенный Telegram-аккаунт, чтобы работать с событиями календаря.
              </div>
            ) : null}
            {!eventsQuery.isLoading && !eventsUnauthorized ? (
              sortedEvents.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-4 py-2">Название</th>
                        <th className="px-4 py-2">Начало</th>
                        <th className="px-4 py-2">Конец</th>
                        <th className="px-4 py-2">Описание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEvents.map((eventItem) => (
                        <tr key={eventItem.id} className="border-t border-subtle">
                          <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{eventItem.title}</td>
                          <td className="px-4 py-3 text-muted">{formatDateTime(eventItem.start_at)}</td>
                          <td className="px-4 py-3 text-muted">{formatDateTime(eventItem.end_at)}</td>
                          <td className="px-4 py-3 text-sm text-[var(--text-primary)]">
                            {eventItem.description || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-subtle p-6 text-sm text-muted">
                  События не найдены — создайте первое, указав время начала и (опционально) длительность.
                </div>
              )
            ) : null}
          </Card>

          <Card className="flex flex-col gap-4">
            <Toolbar justify="between">
              <div>
                <div className="text-base font-semibold text-[var(--text-primary)]">План на ближайшее</div>
                <div className="text-xs text-muted">Виртуальные элементы PARA из `/api/v1/calendar/agenda`</div>
              </div>
              <Field label="Период" className="w-auto" inline>
                <Select
                  value={String(agendaDays)}
                  onChange={(event) => setAgendaDays(Number(event.target.value))}
                >
                  {AGENDA_RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </Toolbar>
            {agendaQuery.isLoading ? <div className="text-sm text-muted">Собираем план…</div> : null}
            {agendaUnauthorized ? (
              <div className="rounded-2xl border border-dashed border-subtle bg-surface-soft p-6 text-sm text-muted">
                Подключите Telegram, чтобы видеть и редактировать календарные элементы PARA.
              </div>
            ) : null}
            {!agendaQuery.isLoading && !agendaUnauthorized ? (
              agendaByDay.length ? (
                <div className="flex flex-col gap-4">
                  {agendaByDay.map((group) => {
                    const date = new Date(group.day);
                    const isToday = (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const cmp = new Date(date);
                      cmp.setHours(0, 0, 0, 0);
                      return today.getTime() === cmp.getTime();
                    })();
                    return (
                      <div key={group.day} className="flex flex-col gap-3">
                        <div className={cn('text-sm font-semibold text-[var(--text-primary)]', isToday ? 'text-[var(--accent-primary)]' : null)}>
                          {formatDateLabel(date)}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {group.items.map((item) => (
                            <CalendarItemCard
                              key={item.id}
                              item={item}
                              areaMap={areaMap}
                              projectMap={projectMap}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-subtle p-6 text-sm text-muted">
                  В выбранном периоде нет событий PARA. Добавьте новую запись ниже.
                </div>
              )
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <form onSubmit={handleEventSubmit}>
            <Card className="flex flex-col gap-4">
              <div>
                <div className="text-base font-semibold text-[var(--text-primary)]">Новое событие</div>
                <p className="text-sm text-muted">Классические события календаря, синхронизирующиеся с Telegram.</p>
              </div>
              <Field label="Название" required>
                <Input
                  value={eventForm.title}
                  onChange={(event) => setEventForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Например: демо для клиента"
                  disabled={createEventMutation.isPending}
                />
              </Field>
              <Field label="Описание">
                <Textarea
                  value={eventForm.description}
                  onChange={(event) => setEventForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={4}
                  disabled={createEventMutation.isPending}
                />
              </Field>
              <Field label="Начало" required>
                <Input
                  type="datetime-local"
                  value={eventForm.start}
                  onChange={(event) => setEventForm((prev) => ({ ...prev, start: event.target.value }))}
                  disabled={createEventMutation.isPending}
                />
              </Field>
              <Field label="Конец">
                <Input
                  type="datetime-local"
                  value={eventForm.end}
                  onChange={(event) => setEventForm((prev) => ({ ...prev, end: event.target.value }))}
                  disabled={createEventMutation.isPending}
                />
              </Field>
              {eventError ? <div className="text-sm text-red-600">{eventError}</div> : null}
              <Button type="submit" disabled={createEventMutation.isPending}>
                {createEventMutation.isPending ? 'Сохраняем…' : 'Создать событие'}
              </Button>
            </Card>
          </form>

          <form onSubmit={handleItemSubmit}>
            <Card className="flex flex-col gap-4">
              <div>
                <div className="text-base font-semibold text-[var(--text-primary)]">Добавить запись PARA</div>
                <p className="text-sm text-muted">Создайте структурированное событие, привязанное к области или проекту.</p>
              </div>
              <Field label="Название" required>
                <Input
                  value={itemForm.title}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Например: ревью стратегии"
                  disabled={createItemMutation.isPending}
                />
              </Field>
              <Field label="Описание">
                <Textarea
                  value={itemForm.description}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={4}
                  disabled={createItemMutation.isPending}
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Начало" required>
                  <Input
                    type="datetime-local"
                    value={itemForm.start}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, start: event.target.value }))}
                    disabled={createItemMutation.isPending}
                  />
                </Field>
                <Field label="Конец">
                  <Input
                    type="datetime-local"
                    value={itemForm.end}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, end: event.target.value }))}
                    disabled={createItemMutation.isPending}
                  />
                </Field>
              </div>
              <Field label="Контекст" required>
                <Select
                  value={itemForm.scope}
                  onChange={(event) =>
                    setItemForm((prev) => ({
                      ...prev,
                      scope: event.target.value as AgendaScope,
                    }))
                  }
                  disabled={createItemMutation.isPending}
                >
                  <option value="area">Область</option>
                  <option value="project">Проект</option>
                </Select>
              </Field>
              {itemForm.scope === 'area' ? (
                <Field label="Область" required>
                  <Select
                    value={itemForm.areaId}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, areaId: event.target.value }))}
                    disabled={createItemMutation.isPending || areasQuery.isLoading}
                  >
                    {(areasQuery.data ?? []).map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field label="Проект" required>
                  <Select
                    value={itemForm.projectId}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, projectId: event.target.value }))}
                    disabled={createItemMutation.isPending || projectsQuery.isLoading}
                  >
                    {(projectsQuery.data ?? []).map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <div className="text-xs text-muted">Таймзона события: {clientTimezone}</div>
              {itemError ? <div className="text-sm text-red-600">{itemError}</div> : null}
              <Button type="submit" disabled={createItemMutation.isPending}>
                {createItemMutation.isPending ? 'Сохраняем…' : 'Добавить запись'}
              </Button>
            </Card>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
