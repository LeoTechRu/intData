'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import PageLayout from '../PageLayout';
import { apiFetch, ApiError } from '../../lib/api';
import type { Profile } from '../../lib/types';

interface ProfileViewProps {
  entity: 'areas' | 'projects' | 'resources' | 'users' | 'groups' | 'products';
  slug: string;
  backHref?: string;
  backLabel?: string;
}

function formatMetaEntries(meta: Record<string, string | number | boolean | null>) {
  return Object.entries(meta).map(([key, value]) => ({
    key,
    value: value === null || value === undefined ? '—' : String(value),
  }));
}

export default function ProfileView({ entity, slug, backHref, backLabel }: ProfileViewProps) {
  const query = useQuery<Profile>({
    queryKey: ['profile', entity, slug],
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
    queryFn: () => apiFetch<Profile>(`/api/v1/profiles/${entity}/${slug}`),
  });

  const metaRows = useMemo(() => formatMetaEntries(query.data?.profile_meta ?? {}), [query.data]);
  const sections = query.data?.sections ?? [];
  const tags = query.data?.tags ?? [];

  const isLoading = query.isLoading;
  const error = query.error as unknown;
  const errorMessage = error
    ? error instanceof ApiError
      ? error.message
      : 'Не удалось загрузить профиль'
    : null;

  const displayName = query.data?.display_name ?? slug;

  return (
    <PageLayout
      title={displayName}
      description={query.data?.headline ?? undefined}
      contentClassName="flex flex-col gap-6 p-0"
    >
      <div className="flex flex-col gap-6">
        <header className="relative isolate overflow-hidden rounded-3xl border border-subtle bg-[var(--surface-0)]">
          {query.data?.cover_url ? (
            <div
              className="h-48 w-full bg-cover bg-center md:h-56"
              style={{
                backgroundImage: `linear-gradient(135deg, rgba(15,23,42,0.35), rgba(30,41,59,0.25)), url('${query.data.cover_url}')`,
              }}
              aria-hidden
            />
          ) : null}
          <div className="flex flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:gap-6">
            <div className="-mt-12 h-20 w-20 overflow-hidden rounded-2xl border-4 border-[var(--surface-0)] bg-surface-soft md:-mt-16 md:h-28 md:w-28">
              {query.data?.avatar_url ? (
                <Image
                  src={query.data.avatar_url}
                  alt="Аватар"
                  width={112}
                  height={112}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl" aria-hidden>
                  📌
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-2xl font-semibold text-[var(--text-primary)] md:text-3xl">
                {isLoading ? 'Загрузка…' : displayName}
              </p>
              {query.data?.headline ? (
                <p className="text-sm text-muted">{query.data.headline}</p>
              ) : null}
              {query.data?.summary ? (
                <p className="text-sm text-[var(--text-primary)]">{query.data.summary}</p>
              ) : null}
            </div>
            {backHref ? (
              <div className="flex items-start">
                <Link
                  href={backHref}
                  prefetch={false}
                  className="inline-flex items-center gap-2 rounded-full border border-subtle px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-base hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
                >
                  {backLabel ?? '← Вернуться'}
                </Link>
              </div>
            ) : null}
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600">{errorMessage}</div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-subtle bg-[var(--surface-0)] p-6">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Информация</h2>
            {isLoading ? (
              <ul className="mt-4 space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <li key={index} className="h-4 w-full animate-pulse rounded-full bg-surface-soft" />
                ))}
              </ul>
            ) : metaRows.length > 0 ? (
              <dl className="mt-4 grid gap-3 text-sm">
                {metaRows.map((row) => (
                  <div key={row.key} className="flex flex-col">
                    <dt className="text-xs uppercase tracking-wide text-muted">{row.key}</dt>
                    <dd className="text-sm text-[var(--text-primary)]">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted">Подробности не заполнены.</p>
            )}
          </section>

          <section className="rounded-3xl border border-subtle bg-[var(--surface-0)] p-6">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Теги</h2>
            {isLoading ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <li key={index} className="h-6 w-20 animate-pulse rounded-full bg-surface-soft" />
                ))}
              </ul>
            ) : tags.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <li key={tag} className="rounded-full bg-surface-soft px-3 py-1 text-xs text-[var(--text-primary)]">
                    {tag}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">Нет тегов.</p>
            )}
          </section>
        </div>

        <section className="rounded-3xl border border-subtle bg-[var(--surface-0)] p-6">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Секции</h2>
          {isLoading ? (
            <ul className="mt-4 space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <li key={index} className="h-10 w-full animate-pulse rounded-xl bg-surface-soft" />
              ))}
            </ul>
          ) : sections.length > 0 ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {sections.map((section) => (
                <article key={section.id} className="rounded-2xl border border-subtle bg-surface-soft p-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {section.title ?? section.id}
                  </h3>
                  <p className="mt-1 text-xs text-muted">Содержимое появится, когда владелец поделится доступом.</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Для вас нет доступных секций.</p>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
