'use client';

import React, { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import PageLayout from '../PageLayout';
import { apiFetch, ApiError } from '../../lib/api';
import type { Area, Project } from '../../lib/types';
import { buildAreaOptions } from '../../lib/areas';
import { Button, Card, Field, Input, Select, Textarea } from '../ui';

const MODULE_TITLE = 'Проекты';
const MODULE_DESCRIPTION = 'Управляйте проектами, привязывайте их к областям и отслеживайте структуру PARA.';

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

export default function ProjectsModule() {
  const areasQuery = useAreas();
  const projectsQuery = useProjects();
  const [form, setForm] = useState<FormState>({ name: '', areaId: '', slug: '', description: '' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadError = (areasQuery.error ?? projectsQuery.error) as unknown;
  const loadErrorMessage = loadError
    ? loadError instanceof ApiError
      ? loadError.message
      : 'Не удалось загрузить данные'
    : null;

  const areaOptions = useMemo(() => buildAreaOptions(areasQuery.data ?? []), [areasQuery.data]);
  const areaMap = useMemo(() => {
    const map = new Map<number, Area>();
    (areasQuery.data ?? []).forEach((area) => map.set(area.id, area));
    return map;
  }, [areasQuery.data]);

  const createMutation = useMutation({
    mutationFn: async (payload: CreatePayload) => {
      return apiFetch<Project>('/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setForm({ name: '', areaId: '', slug: '', description: '' });
      setErrorMessage(null);
      projectsQuery.refetch();
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        const details = typeof error.info === 'object' && error.info !== null ? (error.info as any).detail : null;
        setErrorMessage(details ?? error.message);
        return;
      }
      setErrorMessage('Не удалось создать проект');
    },
  });

  const isLoading = projectsQuery.isLoading || areasQuery.isLoading;
  const hasProjects = (projectsQuery.data?.length ?? 0) > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.areaId) {
      setErrorMessage('Укажите название и область');
      return;
    }
    const payload: CreatePayload = {
      name: form.name.trim(),
      area_id: Number(form.areaId),
      description: form.description.trim() ? form.description.trim() : null,
      slug: form.slug.trim() ? form.slug.trim() : null,
    };
    createMutation.mutate(payload);
  };

  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION}>
      <Card surface="soft">
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название проекта" required htmlFor="project-name">
              <Input
                id="project-name"
                name="name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Новый проект"
                required
              />
            </Field>
            <Field label="Область (Area)" required htmlFor="project-area">
              <Select
                id="project-area"
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
            <Field label="Слаг (опционально)" htmlFor="project-slug">
              <Input
                id="project-slug"
                name="slug"
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                placeholder="project-alpha"
              />
            </Field>
            <Field label="Описание (опционально)" htmlFor="project-description">
              <Textarea
                id="project-description"
                name="description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                placeholder="Краткое описание для команды"
                className="min-h-[96px]"
              />
            </Field>
          </div>
          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
              {errorMessage}
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Сохраняем…' : 'Добавить проект'}
            </Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-muted">
          Выбирайте листья дерева Areas: родительские узлы недоступны для привязки проектов.
        </p>
      </Card>

      {loadErrorMessage ? (
        <Card className="border-red-200/80 bg-red-50 text-sm text-red-700">
          <strong className="font-semibold">{loadErrorMessage}</strong>
          <span className="mt-1 text-xs text-red-600/80">Попробуйте обновить страницу или проверьте соединение с сервером.</span>
        </Card>
      ) : null}

      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead className="bg-surface-soft text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium">Название</th>
                <th className="px-5 py-3 font-medium">Area</th>
                <th className="px-5 py-3 font-medium">Slug</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`loading-${index}`} className="animate-pulse border-t border-subtle-soft">
                    <td className="px-5 py-3">
                      <div className="h-3 w-12 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-3 w-32 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-3 w-24 rounded-full bg-surface-soft" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-3 w-20 rounded-full bg-surface-soft" />
                    </td>
                  </tr>
                ))
              ) : hasProjects ? (
                projectsQuery.data?.map((project) => {
                  const area = areaMap.get(project.area_id);
                  return (
                    <tr key={project.id} className="border-t border-subtle">
                      <td className="px-5 py-3 font-mono text-xs text-muted">#{project.id}</td>
                      <td className="px-5 py-3 font-medium text-[var(--text-primary)]">{project.name}</td>
                      <td className="px-5 py-3 text-sm text-[var(--text-primary)]">
                        {area ? area.name : `Area #${project.area_id}`}
                      </td>
                      <td className="px-5 py-3 text-sm text-muted">{project.slug ?? '—'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-muted">
                    Пока нет проектов — добавьте первый, чтобы связать задачи и материалы.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PageLayout>
  );
}
