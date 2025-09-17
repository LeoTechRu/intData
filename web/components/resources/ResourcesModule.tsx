'use client';

import React, { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import PageLayout from '../PageLayout';
import { apiFetch, ApiError } from '../../lib/api';
import type { Resource } from '../../lib/types';
import { Button, Card, Field, Input, Textarea, Toolbar } from '../ui';

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
      <Toolbar>
        <label className="flex flex-1 items-center gap-2" htmlFor="resource-search">
          <span className="text-muted" aria-hidden>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5a6 6 0 015.2 8.94l3.43 3.43a1 1 0 01-1.42 1.42l-3.43-3.43A6 6 0 1111 5z" />
            </svg>
          </span>
          <Input
            id="resource-search"
            type="search"
            inputMode="search"
            placeholder="Поиск ресурсов"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="bg-transparent placeholder:text-muted"
          />
        </label>
        <span className="text-sm text-muted">{resources.length} всего</span>
      </Toolbar>

      <Card surface="soft">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Новый ресурс</h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <Field label="Заголовок" required className="md:col-span-2" htmlFor="resource-title">
            <Input
              id="resource-title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Например, Руководство по запуску"
              required
            />
          </Field>
          <Field label="Тип (опционально)" htmlFor="resource-type">
            <Input
              id="resource-type"
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
              placeholder="Документ, Ссылка, Видео"
            />
          </Field>
          <Field
            label="Описание / примечание (опционально)"
            className="md:col-span-2"
            htmlFor="resource-content"
          >
            <Textarea
              id="resource-content"
              rows={3}
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="Ссылка, файлы или краткое описание содержимого"
              className="min-h-[96px]"
            />
          </Field>
          {errorMessage ? (
            <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
              {errorMessage}
            </div>
          ) : null}
          <div className="md:col-span-2 flex items-center justify-end">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Сохраняем…' : 'Добавить ресурс'}
            </Button>
          </div>
        </form>
      </Card>

      {loadErrorMessage ? (
        <Card className="border-red-200/80 bg-red-50 text-sm text-red-700">
          {loadErrorMessage}
        </Card>
      ) : null}

      {showEmpty ? (
        <Card surface="soft" className="text-sm text-muted">
          Ресурсы не найдены. Добавьте первый артефакт или измените условия поиска.
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((resource) => (
            <Card key={resource.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-[var(--text-primary)]">{resource.title}</div>
                  {resource.type ? <div className="text-xs uppercase tracking-wide text-muted">{resource.type}</div> : null}
                </div>
                <span className="text-xs font-mono text-muted">ID {resource.id}</span>
              </div>
              {resource.content ? <p className="text-sm text-muted">{resource.content}</p> : null}
              <div className="text-xs text-muted">
                Обновлено {new Date(resource.updated_at).toLocaleString('ru-RU')}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
