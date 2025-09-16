'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface InboxNote {
  id: number;
  title?: string | null;
  content: string;
}

const QUERY_KEY = ['inbox'];

export default function InboxTable() {
  const [search, setSearch] = useState('');
  const { data, error, isLoading, isFetching, refetch } = useQuery<InboxNote[]>({
    queryKey: QUERY_KEY,
    staleTime: 30_000,
    gcTime: 300_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_URL ?? '';
      const res = await fetch(`${apiBase}/api/v1/inbox/notes`, {
        credentials: 'include',
        signal,
      });
      if (!res.ok) {
        throw new Error('Не удалось загрузить входящие');
      }
      return res.json();
    },
  });

  const normalized = search.trim().toLowerCase();
  const notes = useMemo(() => data ?? [], [data]);
  const filteredNotes = useMemo(() => {
    if (!normalized) {
      return notes;
    }
    return notes.filter((note) => {
      const title = (note.title ?? '').toLowerCase();
      const content = (note.content ?? '').toLowerCase();
      return title.includes(normalized) || content.includes(normalized);
    });
  }, [notes, normalized]);

  const showEmpty = !isLoading && filteredNotes.length === 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="inbox-search" className="relative flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-subtle bg-surface-soft px-3 py-2 text-sm">
          <span className="text-muted" aria-hidden>
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5a6 6 0 015.2 8.94l3.43 3.43a1 1 0 01-1.42 1.42l-3.43-3.43A6 6 0 1111 5z" />
            </svg>
          </span>
          <input
            id="inbox-search"
            type="search"
            inputMode="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск заметок"
            className="w-full bg-transparent text-base text-[var(--text-primary)] placeholder:text-muted focus-visible:outline-none"
          />
        </label>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted md:inline">{notes.length} всего</span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-[var(--accent-on-primary)] transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] disabled:cursor-progress disabled:opacity-70"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <svg
              aria-hidden
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 11a8 8 0 10-2.6 5.9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 4v7h-7" />
            </svg>
            Обновить
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200/50 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200" role="alert">
          <div>
            <strong className="font-semibold">Не удалось загрузить данные.</strong>
            <div className="text-xs text-muted">{(error as Error).message}</div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md border border-red-400/40 px-3 py-1 text-xs font-medium text-red-700 transition-base hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
          >
            Повторить
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-subtle">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead className="bg-surface-soft text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">ID</th>
              <th scope="col" className="px-4 py-3 font-medium">Заголовок</th>
              <th scope="col" className="px-4 py-3 font-medium">Текст</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="animate-pulse border-t border-subtle-soft">
                  <td className="px-4 py-3">
                    <div className="h-3 w-12 rounded-full bg-surface-soft" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3 w-32 rounded-full bg-surface-soft" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3 w-full rounded-full bg-surface-soft" />
                  </td>
                </tr>
              ))
            ) : showEmpty ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-sm text-muted" data-testid="empty">
                  {normalized ? 'Совпадений не найдено' : 'Здесь пока пусто — добавьте заметку через бота или веб-форму.'}
                </td>
              </tr>
            ) : (
              filteredNotes.map((note) => (
                <tr
                  key={note.id}
                  className="border-t border-subtle transition-base hover:bg-surface-soft"
                >
                  <td className="px-4 py-3 align-top font-mono text-xs text-muted">#{note.id}</td>
                  <td className="px-4 py-3 align-top font-medium text-[var(--text-primary)]">
                    {note.title ?? 'Без названия'}
                  </td>
                  <td className="px-4 py-3 align-top text-sm leading-relaxed text-[var(--text-primary)]">
                    {note.content}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
