'use client';

import Link from 'next/link';
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import PageLayout from '../PageLayout';
import { ApiError, apiFetch } from '../../lib/api';
import type { GroupInfo } from '../../lib/types';
import { Badge, Card, EmptyState, TermHint, Toolbar } from '../ui';

const MODULE_TITLE = 'Телеграм‑группы';
const MODULE_DESCRIPTION =
  'Следите за активностью чатов, начисляйте продукты и управляйте обучающимися прямо из CRM‑панели.';
const TELEGRAM_ID_HINT = 'Telegram ID — числовой идентификатор чата. Его можно получить командой /group в @intDataBot.';
const CRM_HINT = 'CRM — единое место, где мы видим покупки, активность и статусы участников групп.';

function useGroupsOverview() {
  return useQuery<GroupInfo[]>({
    queryKey: ['groups', 'overview'],
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: () => apiFetch<GroupInfo[]>('/api/v1/groups'),
  });
}

const NUMBER_FORMAT = new Intl.NumberFormat('ru-RU');

export default function GroupsOverviewModule() {
  const query = useGroupsOverview();
  const groups = useMemo(() => query.data ?? [], [query.data]);
  const isLoading = query.isLoading;
  const error = query.error as unknown;

  const errorMessage = error
    ? error instanceof ApiError
      ? error.message
      : 'Не удалось загрузить список групп.'
    : null;

  const requiresTelegramLink = error instanceof ApiError && error.status === 400;
  const noGroups = !isLoading && !errorMessage && groups.length === 0;

  return (
    <PageLayout
      title={MODULE_TITLE}
      description={
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <span>{MODULE_DESCRIPTION}</span>
          <TermHint label="CRM" description={CRM_HINT} icon={false} className="text-sm text-muted" />
        </span>
      }
      contentClassName="flex flex-col gap-6"
    >
      <Toolbar className="justify-between">
        <span className="text-sm text-muted">
          {isLoading ? 'Загружаем данные…' : `Всего групп: ${NUMBER_FORMAT.format(groups.length)}`}
        </span>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="rounded-full border border-subtle px-3 py-1 text-xs font-medium text-[var(--text-primary)] transition-base hover:border-[var(--accent-primary)]"
          disabled={query.isFetching}
        >
          {query.isFetching ? 'Обновляем…' : 'Обновить'}
        </button>
      </Toolbar>

      {errorMessage ? (
        <Card className="border-red-200 bg-red-50 text-sm text-red-600" role="alert">
          {errorMessage}
          {requiresTelegramLink ? (
            <p className="mt-2 text-xs text-red-600/90">
              Свяжите Telegram‑аккаунт в разделе настроек или выполните команду <code className="rounded bg-white/60 px-1">/group</code> в @intDataBot.
            </p>
          ) : null}
        </Card>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="groups-skeleton">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Card key={idx} className="h-40 animate-pulse bg-surface-soft" />
          ))}
        </div>
      ) : noGroups ? (
        <EmptyState
          title="Группы не найдены"
          description="Добавьте бота @intDataBot в чат и выполните команду /group, чтобы подключить его к CRM."
          icon="💬"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.telegram_id} as="article" className="flex flex-col gap-4 p-6">
              <header className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{group.title}</h2>
                <p className="text-sm text-muted">{group.description ?? 'Описание ещё не заполнено.'}</p>
              </header>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <Badge tone="neutral" size="sm" uppercase={false}>
                  {NUMBER_FORMAT.format(group.participants_count)} участников
                </Badge>
                <span className="inline-flex items-center gap-1">
                  <TermHint
                    label={<span className="underline decoration-dotted underline-offset-4">Telegram ID</span>}
                    description={TELEGRAM_ID_HINT}
                    icon={false}
                    className="text-xs text-muted"
                  />
                  <code className="rounded-full bg-surface-soft px-2 py-0.5 font-mono text-[0.65rem] text-muted">
                    {group.telegram_id}
                  </code>
                </span>
              </div>
              <div className="mt-auto flex items-center justify-between">
                <Link
                  href={`/groups/manage/${group.telegram_id}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)] hover:underline"
                  prefetch={false}
                >
                  Управлять группой
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
