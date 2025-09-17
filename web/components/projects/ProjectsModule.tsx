'use client';

import Link from 'next/link';
import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import PageLayout from '../PageLayout';
import { ApiError, apiFetch } from '../../lib/api';
import type { Area, Project } from '../../lib/types';
import { buildAreaOptions } from '../../lib/areas';
import { cn } from '../../lib/cn';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  Toolbar,
} from '../ui';

const MODULE_TITLE = 'Проекты';
const MODULE_DESCRIPTION =
  'Каталог всех доступных проектов: фильтруйте по областям, ищите по названию и создавайте новые инициативы в один клик.';

type CreatePayload = {
  name: string;
  area_id: number;
  description?: string | null;
  slug?: string | null;
};

interface FormState {
  name: string;
  areaId: string;
  slug: string;
  description: string;
}

type ViewMode = 'grid' | 'table';
type SortMode = 'recent' | 'name' | 'area';

interface FiltersState {
  areaId: string;
  includeSub: boolean;
  search: string;
  sort: SortMode;
  view: ViewMode;
  onlyWithoutSlug: boolean;
  onlyWithoutDescription: boolean;
}

function useAreas() {
  return useQuery<Area[]>({
    queryKey: ['areas'],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: () => apiFetch<Area[]>('/api/v1/areas'),
  });
}

function useProjects(params?: { areaId?: number; includeSub?: boolean }) {
  return useQuery<Project[]>({
    queryKey: ['projects', params?.areaId ?? null, params?.includeSub ?? false],
    staleTime: 30_000,
    gcTime: 300_000,
    queryFn: () => {
      const search = new URLSearchParams();
      if (params?.areaId) {
        search.set('area_id', String(params.areaId));
        if (params.includeSub) {
          search.set('include_sub', '1');
        }
      }
      const qs = search.toString();
      const suffix = qs ? `?${qs}` : '';
      return apiFetch<Project[]>(`/api/v1/projects${suffix}`);
    },
  });
}

function findQuickArea(areas: Area[]): Area | undefined {
  if (areas.length === 0) {
    return undefined;
  }
  const bySlug = areas.find((area) => area.slug?.toLowerCase() === 'inbox');
  if (bySlug) {
    return bySlug;
  }
  const byName = areas.find((area) => {
    const name = area.name.toLowerCase();
    return name === 'входящие' || name === 'inbox' || name.includes('неразобран');
  });
  if (byName) {
    return byName;
  }
  const root = areas.find((area) => (area.parent_id === null || area.parent_id === undefined) && area.depth === 0);
  return root ?? areas[0];
}

function getProjectHref(project: Project): string {
  const slug = project.slug?.trim();
  const segment = slug && slug.length > 0 ? encodeURIComponent(slug) : String(project.id);
  return `/projects/${segment}`;
}

const NUMBER_FORMATTER = new Intl.NumberFormat('ru-RU');

function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

export default function ProjectsModule() {
  const areasQuery = useAreas();
  const areaOptions = useMemo(() => buildAreaOptions(areasQuery.data ?? []), [areasQuery.data]);
  const areaMap = useMemo(() => {
    const map = new Map<number, Area>();
    (areasQuery.data ?? []).forEach((area) => map.set(area.id, area));
    return map;
  }, [areasQuery.data]);

  const quickArea = useMemo(() => findQuickArea(areasQuery.data ?? []), [areasQuery.data]);

  const [filters, setFilters] = useState<FiltersState>({
    areaId: '',
    includeSub: true,
    search: '',
    sort: 'recent',
    view: 'grid',
    onlyWithoutSlug: false,
    onlyWithoutDescription: false,
  });

  const projectsQuery = useProjects({
    areaId: filters.areaId ? Number(filters.areaId) : undefined,
    includeSub: filters.includeSub,
  });

  const [form, setForm] = useState<FormState>({ name: '', areaId: '', slug: '', description: '' });
  const [quickName, setQuickName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const createModeRef = useRef<'form' | 'quick'>('form');

  useEffect(() => {
    if (!quickArea) {
      return;
    }
    setForm((prev) => {
      if (prev.areaId) {
        return prev;
      }
      return { ...prev, areaId: String(quickArea.id) };
    });
  }, [quickArea]);

  const loadError = (areasQuery.error ?? projectsQuery.error) as unknown;
  const loadErrorMessage = loadError
    ? loadError instanceof ApiError
      ? loadError.message
      : 'Не удалось загрузить данные'
    : null;

  const createMutation = useMutation({
    mutationFn: async (payload: CreatePayload) => {
      return apiFetch<Project>('/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setForm({ name: '', areaId: quickArea ? String(quickArea.id) : '', slug: '', description: '' });
      setQuickName('');
      setFormError(null);
      setQuickError(null);
      projectsQuery.refetch();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof ApiError
          ? typeof error.info === 'object' && error.info !== null && 'detail' in (error.info as Record<string, unknown>)
            ? String((error.info as Record<string, unknown>).detail)
            : error.message
          : 'Не удалось создать проект';
      if (createModeRef.current === 'quick') {
        setQuickError(message);
      } else {
        setFormError(message);
      }
    },
  });

  const rawProjects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  const filteredProjects = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const items = rawProjects.filter((project) => {
      if (filters.onlyWithoutSlug && (project.slug ?? '').trim().length > 0) {
        return false;
      }
      if (filters.onlyWithoutDescription && (project.description ?? '').trim().length > 0) {
        return false;
      }
      if (!query) {
        return true;
      }
      const areaName = areaMap.get(project.area_id)?.name ?? '';
      return (
        project.name.toLowerCase().includes(query) ||
        (project.slug ?? '').toLowerCase().includes(query) ||
        areaName.toLowerCase().includes(query) ||
        (project.description ?? '').toLowerCase().includes(query)
      );
    });

    const sorted = [...items];
    if (filters.sort === 'recent') {
      sorted.sort((a, b) => b.id - a.id);
    } else if (filters.sort === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    } else {
      sorted.sort((a, b) => {
        const areaA = areaMap.get(a.area_id)?.name ?? '';
        const areaB = areaMap.get(b.area_id)?.name ?? '';
        const byArea = areaA.localeCompare(areaB, 'ru');
        if (byArea !== 0) {
          return byArea;
        }
        return a.name.localeCompare(b.name, 'ru');
      });
    }
    return sorted;
  }, [areaMap, filters.onlyWithoutDescription, filters.onlyWithoutSlug, filters.search, filters.sort, rawProjects]);

  const projectGroups = useMemo(() => {
    const groups = new Map<number, { area: Area | null; projects: Project[]; order: number }>();
    filteredProjects.forEach((project, index) => {
      const area = areaMap.get(project.area_id) ?? null;
      const key = area?.id ?? -1;
      const existing = groups.get(key);
      if (existing) {
        existing.projects.push(project);
      } else {
        groups.set(key, { area, projects: [project], order: index });
      }
    });
    return Array.from(groups.values()).sort((a, b) => a.order - b.order);
  }, [areaMap, filteredProjects]);

  const inboxProjectsCount = quickArea ? rawProjects.filter((project) => project.area_id === quickArea.id).length : 0;
  const uniqueAreasCount = rawProjects.reduce((acc, project) => acc.add(project.area_id), new Set<number>()).size;
  const sluggedCount = rawProjects.filter((project) => (project.slug ?? '').trim().length > 0).length;
  const missingSlugCount = rawProjects.length - sluggedCount;
  const describedCount = rawProjects.filter((project) => (project.description ?? '').trim().length > 0).length;
  const missingDescriptionCount = rawProjects.length - describedCount;
  const slugCoveragePercent = rawProjects.length > 0 ? Math.round((sluggedCount / rawProjects.length) * 100) : 0;
  const descriptionCoveragePercent = rawProjects.length > 0 ? Math.round((describedCount / rawProjects.length) * 100) : 0;

  const isInitialLoading = projectsQuery.isLoading || areasQuery.isLoading;
  const isRefetching = projectsQuery.isFetching && !projectsQuery.isLoading;
  const hasProjects = filteredProjects.length > 0;

  const handleFilterChange = (patch: Partial<FiltersState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleQuickCreate = () => {
    if (!quickArea) {
      setQuickError('Нет доступной области для быстрого создания. Создайте область или выберите её вручную.');
      return;
    }
    if (!quickName.trim()) {
      setQuickError('Введите название проекта.');
      return;
    }
    createModeRef.current = 'quick';
    setQuickError(null);
    setFormError(null);
    const payload: CreatePayload = {
      name: quickName.trim(),
      area_id: quickArea.id,
    };
    createMutation.mutate(payload);
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.areaId) {
      setFormError('Укажите название и область проекта.');
      return;
    }
    const payload: CreatePayload = {
      name: form.name.trim(),
      area_id: Number(form.areaId),
      description: form.description.trim() ? form.description.trim() : null,
      slug: form.slug.trim() ? form.slug.trim() : null,
    };
    createModeRef.current = 'form';
    setQuickError(null);
    setFormError(null);
    createMutation.mutate(payload);
  };

  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION} contentClassName="flex flex-col gap-6">
      <Card surface="soft" className="flex flex-col gap-6" data-testid="projects-create-card">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),auto] md:items-end">
          <Field
            label="Название проекта"
            required
            description={quickArea ? `Проект появится в области «${quickArea.name}» — можно перенести позже.` : 'Выберите область ниже, чтобы создать проект.'}
          >
            <Input
              value={quickName}
              onChange={(event) => setQuickName(event.target.value)}
              placeholder="Новый проект по OKR"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleQuickCreate();
                }
              }}
            />
          </Field>
          <Button
            type="button"
            disabled={createMutation.isPending || !quickArea}
            onClick={handleQuickCreate}
            className="w-full md:w-auto"
            data-testid="projects-quick-create-button"
          >
            {createMutation.isPending && createModeRef.current === 'quick'
              ? 'Создаём…'
              : quickArea
              ? `Быстро в «${quickArea.name}»`
              : 'Нет области для быстрого старта'}
          </Button>
        </div>
        {quickError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700" role="alert">
            {quickError}
          </div>
        ) : null}

        <div className="h-px w-full bg-surface-soft" aria-hidden />

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleFormSubmit} noValidate>
          <Field label="Название" required>
            <Input
              name="name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Project Phoenix"
              required
            />
          </Field>
          <Field label="Область (Area)" required>
            <Select
              name="area"
              value={form.areaId}
              onChange={(event) => setForm((prev) => ({ ...prev, areaId: event.target.value }))}
              required
              disabled={areasQuery.isLoading}
            >
              <option value="">— выберите область —</option>
              {areaOptions.map((area) => (
                <option key={area.id} value={area.id} disabled={!area.isLeaf}>
                  {area.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Слаг (опционально)">
            <Input
              name="slug"
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              placeholder="project-alpha"
            />
          </Field>
          <Field label="Описание">
            <Textarea
              name="description"
              rows={3}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Опишите цели, KPI и ключевые результаты проекта."
              className="min-h-[96px]"
            />
          </Field>
          {formError ? (
            <div className="md:col-span-2">
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
                {formError}
              </div>
            </div>
          ) : null}
          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <Button type="submit" disabled={createMutation.isPending && createModeRef.current === 'form'} data-testid="projects-form-submit">
              {createMutation.isPending && createModeRef.current === 'form' ? 'Сохраняем…' : 'Создать проект'}
            </Button>
          </div>
        </form>
        <p className="text-xs text-muted">
          Для соблюдения PARA выбирайте конечные (листовые) области. Проекты внутри наследуют область для связанной работы.
        </p>
      </Card>

      <Toolbar className="gap-4" justify="between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[180px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden>
              🔍
            </span>
            <Input
              className="pl-9"
              value={filters.search}
              onChange={(event) => handleFilterChange({ search: event.target.value })}
              placeholder="Поиск по проектам, областям или слагам"
              data-testid="projects-filter-search"
            />
          </div>
          <Select
            value={filters.areaId}
            onChange={(event) => handleFilterChange({ areaId: event.target.value })}
            className="min-w-[180px]"
            aria-label="Фильтр по области"
            data-testid="projects-filter-area"
          >
            <option value="">Все области</option>
            {areaOptions.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))}
          </Select>
          <label className={cn('inline-flex items-center gap-2 text-xs text-muted', !filters.areaId && 'opacity-60')}>
            <Checkbox
              checked={filters.includeSub}
              onChange={(event) => handleFilterChange({ includeSub: event.target.checked })}
              disabled={!filters.areaId}
              data-testid="projects-filter-include-sub"
            />
            <span>Подобласти</span>
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-muted">
            <Checkbox
              checked={filters.onlyWithoutSlug}
              onChange={(event) => handleFilterChange({ onlyWithoutSlug: event.target.checked })}
              data-testid="projects-filter-without-slug"
            />
            <span>Без слага</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.sort}
            onChange={(event) => handleFilterChange({ sort: event.target.value as SortMode })}
            aria-label="Сортировка проектов"
            data-testid="projects-filter-sort"
          >
            <option value="recent">Недавно добавленные</option>
            <option value="name">Название A→Я</option>
            <option value="area">По областям</option>
          </Select>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={filters.view === 'grid' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handleFilterChange({ view: 'grid' })}
              aria-pressed={filters.view === 'grid'}
              data-testid="projects-view-grid"
            >
              Карточки
            </Button>
            <Button
              type="button"
              variant={filters.view === 'table' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handleFilterChange({ view: 'table' })}
              aria-pressed={filters.view === 'table'}
              data-testid="projects-view-table"
            >
              Таблица
            </Button>
          </div>
        </div>
      </Toolbar>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card padded surface="soft" className="flex flex-col gap-1" data-testid="projects-summary-total">
          <span className="text-xs uppercase tracking-wide text-muted">Всего проектов</span>
          <span className="text-2xl font-semibold text-[var(--text-primary)]">{formatNumber(rawProjects.length)}</span>
          <span className="text-xs text-muted">Включая архивы и совместные инициативы</span>
        </Card>
        <Card padded surface="soft" className="flex flex-col gap-1" data-testid="projects-summary-filtered">
          <span className="text-xs uppercase tracking-wide text-muted">В подборке</span>
          <span className="text-2xl font-semibold text-[var(--text-primary)]">{formatNumber(filteredProjects.length)}</span>
          <span className="text-xs text-muted">
            {filters.search || filters.areaId ? 'Учитывает активные фильтры и поиск' : 'Все проекты вашей рабочей области'}
          </span>
        </Card>
        <Card padded surface="soft" className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted">Областей с проектами</span>
          <span className="text-2xl font-semibold text-[var(--text-primary)]">{formatNumber(uniqueAreasCount)}</span>
          <span className="text-xs text-muted">
            {uniqueAreasCount > 0
              ? `В среднем ${(rawProjects.length / uniqueAreasCount).toFixed(1)} проекта на область`
              : 'Создайте первую область, чтобы распределять проекты'}
          </span>
        </Card>
        <Card padded surface="soft" className="flex flex-col gap-1" data-testid="projects-summary-slug">
          <span className="text-xs uppercase tracking-wide text-muted">Покрытие слагами / описаниями</span>
          <span className="text-2xl font-semibold text-[var(--text-primary)]">
            {slugCoveragePercent}% / {descriptionCoveragePercent}%
          </span>
          <span className="text-xs text-muted">
            {rawProjects.length === 0
              ? 'Добавьте проекты, чтобы настроить адреса и быстрый доступ.'
              : `Без слага: ${formatNumber(missingSlugCount)} • Без описания: ${formatNumber(missingDescriptionCount)} • Быстрых проектов в «${quickArea ? quickArea.name : 'область по умолчанию'}»: ${formatNumber(inboxProjectsCount)}`}
          </span>
        </Card>
      </div>

      {loadErrorMessage ? (
        <Card className="border-red-200/80 bg-red-50 text-sm text-red-700">
          <strong className="font-semibold">{loadErrorMessage}</strong>
          <span className="mt-1 block text-xs text-red-600/80">
            Проверьте подключение к серверу или попробуйте перезагрузить страницу.
          </span>
        </Card>
      ) : null}

      {isInitialLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="projects-skeleton">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="animate-pulse space-y-4">
              <div className="h-5 w-40 rounded-full bg-surface-soft" />
              <div className="h-3 w-full rounded-full bg-surface-soft" />
              <div className="h-3 w-3/4 rounded-full bg-surface-soft" />
              <div className="h-3 w-1/2 rounded-full bg-surface-soft" />
            </Card>
          ))}
        </div>
      ) : hasProjects ? (
        filters.view === 'grid' ? (
          <div className="flex flex-col gap-6" data-testid="projects-grid-view">
            {projectGroups.map((group) => (
              <section key={group.area?.id ?? 'unassigned'} className="flex flex-col gap-4">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: group.area?.color ?? 'var(--accent-primary)' }}
                      aria-hidden
                    />
                    <div className="flex flex-col">
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">
                        {group.area ? group.area.name : 'Без области'}
                      </h3>
                      <span className="text-xs text-muted">
                        {formatNumber(group.projects.length)}
                        {' '}
                        {group.projects.length === 1 ? 'проект' : 'проекта'}
                      </span>
                    </div>
                  </div>
                </header>
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {group.projects.map((project) => {
                    const area = areaMap.get(project.area_id) ?? group.area;
                    const hasSlug = (project.slug ?? '').trim().length > 0;
                    const hasDescription = (project.description ?? '').trim().length > 0;
                    return (
                      <Card key={project.id} as="article" className="flex flex-col gap-4 p-6" data-testid="projects-card">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            <h4 className="text-lg font-semibold text-[var(--text-primary)]">{project.name}</h4>
                            <span className="text-xs font-mono text-muted">#{project.id}</span>
                          </div>
                          <Badge tone={project.slug ? 'accent' : 'neutral'} size="sm" uppercase={false}>
                            {project.slug ?? 'черновик'}
                          </Badge>
                        </div>
                        <p className="text-sm leading-6 text-muted">
                          {project.description?.trim() ? project.description : 'Описание появится, когда команда его заполнит.'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[0.65rem]">
                          <Badge tone={hasSlug ? 'accent' : 'warning'} size="sm" uppercase={false}>
                            {hasSlug ? 'Слаг задан' : 'Нет слага'}
                          </Badge>
                          <Badge tone={hasDescription ? 'accent' : 'warning'} size="sm" uppercase={false}>
                            {hasDescription ? 'Описание есть' : 'Нет описания'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-white shadow-sm"
                              style={{ backgroundColor: area?.color ?? 'var(--accent-primary)' }}
                              aria-hidden
                            />
                            <span>{area ? area.name : `Area #${project.area_id}`}</span>
                          </span>
                          <span>Слаг: {project.slug ?? '—'}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <Link
                            href={getProjectHref(project)}
                            prefetch={false}
                            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)] hover:underline"
                            data-testid="projects-card-link"
                          >
                            Перейти к проекту
                            <span aria-hidden>→</span>
                          </Link>
                          <span className="text-xs text-muted">
                            {isRefetching ? 'Обновляем…' : ''}
                          </span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <Card padded={false} className="overflow-hidden" data-testid="projects-table-view">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-sm">
                <thead className="bg-surface-soft text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Проект</th>
                    <th className="px-5 py-3 font-medium">Область</th>
                    <th className="px-5 py-3 font-medium">Слаг</th>
                    <th className="px-5 py-3 font-medium">ID</th>
                    <th className="px-5 py-3 font-medium">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => {
                    const area = areaMap.get(project.area_id);
                    return (
                      <tr key={project.id} className="border-t border-subtle">
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-[var(--text-primary)]">{project.name}</span>
                            {project.description?.trim() ? (
                              <span className="text-xs text-muted">{project.description}</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-[var(--text-primary)]">
                          {area ? area.name : `Area #${project.area_id}`}
                        </td>
                        <td className="px-5 py-4 align-top text-muted">{project.slug ?? '—'}</td>
                        <td className="px-5 py-4 align-top font-mono text-xs text-muted">#{project.id}</td>
                        <td className="px-5 py-4 align-top">
                          <Link
                            href={getProjectHref(project)}
                            prefetch={false}
                            className="inline-flex items-center gap-2 rounded-full border border-subtle px-3 py-1 text-xs font-medium text-[var(--accent-primary)] hover:border-[var(--accent-primary)]"
                          >
                            Открыть
                            <span aria-hidden>↗</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : (
        <EmptyState
          title={rawProjects.length === 0 ? 'Пока нет проектов' : 'По фильтру ничего не найдено'}
          description={
            rawProjects.length === 0
              ? 'Создайте первый проект, чтобы систематизировать задачи и ресурсы в структуре PARA.'
              : 'Попробуйте изменить поиск или сбросить фильтры, чтобы увидеть другие проекты.'
          }
          action={
            rawProjects.length === 0 ? (
              <Button type="button" onClick={() => handleFilterChange({ search: '', areaId: '', view: 'grid' })}>
                Создать проект
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={() => handleFilterChange({ search: '', areaId: '' })}>
                Сбросить фильтры
              </Button>
            )
          }
          icon="📁"
        />
      )}
    </PageLayout>
  );
}
