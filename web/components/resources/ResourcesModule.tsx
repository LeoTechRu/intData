'use client';

import React, { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import PageLayout from '../PageLayout';
import { apiFetch, ApiError } from '../../lib/api';
import type { Resource } from '../../lib/types';

const MODULE_TITLE = 'Ресурсы';
const MODULE_DESCRIPTION = 'Соберите ключевые документы, ссылки и материалы рядом с проектами PARA.';

interface FormState {
  title: string;
  type: string;
  content: string;
}

function useResources() {
  return useQuery<Resource[]>({
    queryKey: ['resources'],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: () => apiFetch<Resource[]>('/api/v1/resources'),
  });
}

export default function ResourcesModule() {
  const [form, setForm] = useState<FormState>({ title: '', type: '', content: '' });
  const [search, setSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resourcesQuery = useResources();

  const resources = useMemo(() => resourcesQuery.data ?? [], [resourcesQuery.data]);
  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return resources;
    }
    return resources.filter((resource) => {
      const title = resource.title.toLowerCase();
      const type = (resource.type ?? '').toLowerCase();
      return title.includes(normalized) || type.includes(normalized);
    });
  }, [resources, search]);

  const createMutation = useMutation({
    mutationFn: async (payload: { title: string; type?: string | null; content?: string | null }) => {
      return apiFetch<Resource>('/api/v1/resources', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setErrorMessage(null);
      setForm({ title: '', type: '', content: '' });
      await resourcesQuery.refetch();
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        const detail = typeof error.info === 'object' && error.info !== null ? (error.info as any).detail : null;
        setErrorMessage(detail ?? error.message);
        return;
      }
      setErrorMessage('Не удалось создать ресурс');
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setErrorMessage('Введите заголовок');
      return;
    }
    createMutation.mutate({
      title: form.title.trim(),
      type: form.type.trim() || null,
      content: form.content.trim() || null,
    });
  };

  const isLoading = resourcesQuery.isLoading;
  const showEmpty = !isLoading && filtered.length === 0;
  const loadError = resourcesQuery.error as unknown;
  const loadErrorMessage = loadError
    ? loadError instanceof ApiError
      ? loadError.message
      : 'Не удалось загрузить данные'
    : null;

  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION}>
      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="resource-search" className="relative flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-subtle bg-surface-soft px-3 py-2 text-sm">
            <span className="text-muted" aria-hidden>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5a6 6 0 015.2 8.94l3.43 3.43a1 1 0 01-1.42 1.42l-3.43-3.43A6 6 0 1111 5z" />
              </svg>
            </span>
            <input
              id="resource-search"
              type="search"
              inputMode="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск ресурсов"
              className="w-full bg-transparent text-base text-[var(--text-primary)] placeholder:text-muted focus-visible:outline-none"
            />
          </label>
          <span className="hidden text-sm text-muted md:inline">{resources.length} всего</span>
        </div>

        <div className="rounded-2xl border border-subtle bg-surface-soft p-6">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Новый ресурс</h2>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="resource-title">
              Заголовок
              <input
                id="resource-title"
                type="text"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Например, Руководство по запуску"
                className="rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="resource-type">
              Тип (опционально)
              <input
                id="resource-type"
                type="text"
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                placeholder="Документ, Ссылка, Видео"
                className="rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1 text-sm text-muted" htmlFor="resource-content">
              Описание / примечание (опционально)
              <textarea
                id="resource-content"
                rows={3}
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="Ссылка, файлы или краткое описание содержимого"
                className="min-h-[96px] rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              />
            </label>
            {errorMessage ? (
              <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</div>
            ) : null}
            <div className="md:col-span-2 flex items-center justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--accent-on-primary)] transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] disabled:cursor-progress disabled:opacity-70"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Сохраняем…' : 'Добавить ресурс'}
              </button>
            </div>
          </form>
        </div>

        {loadErrorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{loadErrorMessage}</div>
        ) : null}

        <div className="rounded-2xl border border-subtle">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead className="bg-surface-soft text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Заголовок</th>
                <th className="px-4 py-3 font-medium">Тип</th>
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
                  </tr>
                ))
              ) : showEmpty ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-sm text-muted">
                    {search.trim() ? 'Совпадений не найдено' : 'Пока нет ресурсов — добавьте первый, чтобы закрепить материалы проекта.'}
                  </td>
                </tr>
              ) : (
                filtered.map((resource) => (
                  <tr key={resource.id} className="border-t border-subtle">
                    <td className="px-4 py-3 font-mono text-xs text-muted">#{resource.id}</td>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{resource.title}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{resource.type ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PageLayout>
  );
}
