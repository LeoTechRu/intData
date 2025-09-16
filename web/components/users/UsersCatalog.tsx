'use client';

import React, { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import PageLayout from '../PageLayout';
import { apiFetch } from '../../lib/api';

interface CatalogProfile {
  slug: string;
  display_name: string;
  headline?: string | null;
  summary?: string | null;
  avatar_url?: string | null;
}

interface UsersResponse extends Array<CatalogProfile> {}

function useUsers(search: string) {
  return useQuery<UsersResponse>({
    queryKey: ['users', search],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set('search', search.trim());
      }
      const qs = params.toString();
      return apiFetch<UsersResponse>(`/api/v1/profiles/users${qs ? `?${qs}` : ''}`);
    },
  });
}

export default function UsersCatalog() {
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const usersQuery = useUsers(submittedSearch);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedSearch(search);
  };

  const users = usersQuery.data ?? [];
  const isLoading = usersQuery.isLoading;
  const hasResults = users.length > 0;

  return (
    <PageLayout title="Команда" description="Каталог пользователей Intelligent Data Pro">      
      <section className="flex flex-col gap-6">
        <form className="flex flex-wrap items-center gap-3" onSubmit={handleSearch}>
          <label htmlFor="users-search" className="relative flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-subtle bg-surface-soft px-3 py-2 text-sm">
            <span className="text-muted" aria-hidden>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5a6 6 0 015.2 8.94l3.43 3.43a1 1 0 01-1.42 1.42l-3.43-3.43A6 6 0 1111 5z" />
              </svg>
            </span>
            <input
              id="users-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по имени или описанию"
              className="w-full bg-transparent text-base text-[var(--text-primary)] placeholder:text-muted focus-visible:outline-none"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--accent-on-primary)] transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
          >
            Найти
          </button>
        </form>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <article key={index} className="rounded-2xl border border-subtle bg-[var(--surface-0)] p-5">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-surface-soft animate-pulse" />
                    <div className="flex flex-col gap-2">
                      <div className="h-3 w-32 rounded-full bg-surface-soft animate-pulse" />
                      <div className="h-3 w-40 rounded-full bg-surface-soft animate-pulse" />
                    </div>
                  </div>
                </article>
              ))
            : !hasResults ? (
                <div className="rounded-2xl border border-dashed border-subtle bg-[var(--surface-0)] p-6 text-sm text-muted">
                  {submittedSearch ? 'Совпадений не найдено.' : 'Команда пока пустая — пригласите коллег и они появятся здесь.'}
                </div>
              ) : (
                users.map((user) => (
                  <Link
                    key={user.slug}
                    href={`/users/${user.slug}`}
                    className="group flex flex-col gap-3 rounded-2xl border border-subtle bg-[var(--surface-0)] p-5 transition-base hover:-translate-y-1 hover:border-[var(--accent-primary)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-surface-soft">
                        {user.avatar_url ? (
                          <Image
                            src={user.avatar_url}
                            alt="Аватар пользователя"
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <span aria-hidden className="text-lg">👤</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{user.display_name}</span>
                        {user.headline ? <span className="text-xs text-muted">{user.headline}</span> : null}
                      </div>
                    </div>
                    {user.summary ? (
                      <p className="text-sm text-muted line-clamp-3">{user.summary}</p>
                    ) : null}
                    <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent-primary)]">
                      Открыть профиль →
                    </span>
                  </Link>
                ))
              )}
        </div>
      </section>
    </PageLayout>
  );
}
