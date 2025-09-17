'use client';

import React, { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import PageLayout from '../PageLayout';
import { apiFetch, ApiError } from '../../lib/api';
import { Button, Card, EmptyState, Input, Toolbar } from '../ui';

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
    retry: false,
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
  const isFetching = usersQuery.isFetching;
  const hasResults = users.length > 0;
  const error = usersQuery.error as unknown;
  const hasError = Boolean(error);
  const errorMessage = hasError
    ? error instanceof ApiError && error.message && !/body is unusable/i.test(error.message)
      ? error.message
      : 'Не удалось загрузить каталог'
    : null;

  const showEmptyState = !isLoading && !isFetching && !hasResults && !hasError;

  return (
    <PageLayout
      title="Команда"
      description="Каталог пользователей Intelligent Data Pro"
      contentClassName="flex flex-col gap-6 p-6 md:p-8"
    >
      <form onSubmit={handleSearch} className="flex flex-col gap-4">
        <Toolbar justify="between">
          <label htmlFor="users-search" className="flex flex-1 items-center gap-2">
            <span className="text-muted" aria-hidden>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5a6 6 0 015.2 8.94l3.43 3.43a1 1 0 01-1.42 1.42l-3.43-3.43A6 6 0 1111 5z" />
              </svg>
            </span>
            <Input
              id="users-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по имени или описанию"
              className="bg-transparent"
            />
          </label>
          <Button type="submit" variant="primary" size="md">
            Найти
          </Button>
        </Toolbar>
      </form>

      {hasError ? (
        <Card className="border-red-200/80 bg-red-50 text-sm text-red-700" role="alert">
          <div className="flex flex-col gap-1">
            <strong className="text-red-700">{errorMessage}</strong>
            <span className="text-xs text-muted">Попробуйте обновить страницу или проверьте подключение к сети.</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => usersQuery.refetch()}
          >
            Повторить
          </Button>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="animate-pulse bg-surface-soft">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-surface" />
                <div className="flex flex-col gap-2">
                  <div className="h-3 w-32 rounded-full bg-surface" />
                  <div className="h-3 w-40 rounded-full bg-surface" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : showEmptyState ? (
        <EmptyState
          title={submittedSearch ? 'Совпадений не найдено' : 'Команда пока пустая'}
          description={
            submittedSearch
              ? 'Попробуйте изменить поисковый запрос или проверьте правописание.'
              : 'Пригласите коллег, и их профили появятся в каталоге.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => (
            <Link key={user.slug} href={`/users/${user.slug}`} prefetch={false} className="group">
              <Card
                as="article"
                className="flex h-full flex-col gap-3 transition-base hover:-translate-y-1 hover:border-[var(--accent-primary)]"
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
                {user.summary ? <p className="line-clamp-3 text-sm text-muted">{user.summary}</p> : null}
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent-primary)]">
                  Открыть профиль →
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
