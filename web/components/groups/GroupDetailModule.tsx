'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import PageLayout from '../PageLayout';
import { ApiError, apiFetch } from '../../lib/api';
import type {
  CrmProductStatus,
  GroupDetail,
  GroupMember,
  GroupMemberProduct,
  GroupProductSummary,
  GroupPruneResponse,
} from '../../lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  TermHint,
  Textarea,
} from '../ui';

const MODULE_DESCRIPTION =
  'CRM‑панель для кураторов: обновляйте статусы покупок, оставляйте заметки и контролируйте дисциплину участников.';
const TELEGRAM_ID_HINT = 'Telegram ID — числовой идентификатор чата. Его можно получить в @intDataBot командой /group.';
const SLUG_HINT =
  'Слаг продукта — короткое имя вроде focus-bootcamp. Его используем, чтобы однозначно определить продукт при назначении.';
const TAGS_HINT = 'Теги помогают строить сегменты (например, cohort-2025, internal). Вводите через запятую.';
const TRIAL_HINT = 'Поле «Пробный доступ до» фиксирует дату, после которой система пометит участника для продления или отключения.';
const PRODUCT_STATUS_LABELS: Record<CrmProductStatus, string> = {
  pending: 'ожидает',
  trial: 'пробный',
  paid: 'оплачен',
  refunded: 'возврат',
  gift: 'подарок',
};

const PRODUCT_STATUS_OPTIONS: { value: CrmProductStatus; label: string }[] = [
  { value: 'paid', label: 'Оплачен' },
  { value: 'trial', label: 'Пробный доступ' },
  { value: 'pending', label: 'Ожидает оплаты' },
  { value: 'gift', label: 'Подарок' },
  { value: 'refunded', label: 'Возврат средств' },
];

function useGroupDetail(groupId: number) {
  return useQuery<GroupDetail>({
    queryKey: ['groups', 'detail', groupId],
    enabled: Number.isFinite(groupId) && groupId > 0,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    queryFn: () => apiFetch<GroupDetail>(`/api/v1/groups/${groupId}`),
  });
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function formatDateInput(value?: string | null): string {
  if (!value) {
    return '';
  }
  return value.slice(0, 10);
}

function normalizeTags(raw: string): string[] | null {
  const parts = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

interface GroupMemberRowProps {
  groupId: number;
  member: GroupMember;
  products: GroupProductSummary[];
  onRefetch: () => void;
}

function GroupMemberRow({ groupId, member, products, onRefetch }: GroupMemberRowProps) {
  const [notes, setNotes] = useState(member.crm_notes ?? '');
  const [tags, setTags] = useState(member.crm_tags.join(', '));
  const [trial, setTrial] = useState(formatDateInput(member.trial_expires_at));
  const [assignSlug, setAssignSlug] = useState('');
  const [assignStatus, setAssignStatus] = useState<CrmProductStatus>('paid');
  const [assignSource, setAssignSource] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(member.crm_notes ?? '');
    setTags(member.crm_tags.join(', '));
    setTrial(formatDateInput(member.trial_expires_at));
  }, [member.crm_notes, member.crm_tags, member.trial_expires_at]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const payload = {
        notes: notes.trim() ? notes.trim() : null,
        trial_expires_at: trial ? new Date(trial).toISOString() : null,
        tags: normalizeTags(tags),
      };
      return apiFetch<GroupMember>(
        `/api/v1/groups/${groupId}/members/${member.telegram_id}/profile`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        },
      );
    },
    onSuccess: (updated) => {
      setFeedback('Профиль участника обновлён.');
      setError(null);
      setNotes(updated.crm_notes ?? '');
      setTags(updated.crm_tags.join(', '));
      setTrial(formatDateInput(updated.trial_expires_at));
      onRefetch();
    },
    onError: (err: unknown) => {
      setFeedback(null);
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить профиль.');
    },
  });

  const assignProduct = useMutation({
    mutationFn: async () => {
      const payload = {
        product_slug: assignSlug.trim(),
        status: assignStatus,
        source: assignSource.trim() || null,
      };
      return apiFetch(`/api/v1/groups/${groupId}/members/${member.telegram_id}/products`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setFeedback('Продукт назначен.');
      setError(null);
      setAssignSlug('');
      setAssignSource('');
      setAssignStatus('paid');
      onRefetch();
    },
    onError: (err: unknown) => {
      setFeedback(null);
      setError(err instanceof ApiError ? err.message : 'Не удалось назначить продукт.');
    },
  });

  const removeProduct = useMutation({
    mutationFn: async (productId: number) => {
      return apiFetch(`/api/v1/groups/${groupId}/members/${member.telegram_id}/products/${productId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      setFeedback('Продукт удалён.');
      setError(null);
      onRefetch();
    },
    onError: (err: unknown) => {
      setFeedback(null);
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить продукт.');
    },
  });

  const pending = updateProfile.isPending || assignProduct.isPending || removeProduct.isPending;

  return (
    <tr className="border-t border-subtle align-top" key={member.telegram_id}>
      <td className="px-4 py-4">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-[var(--text-primary)]">{member.display_name}</span>
          <span className="text-xs text-muted">@{member.username ?? '—'}</span>
          <div className="flex items-center gap-2 text-[0.65rem] text-muted">
            {member.is_owner ? <Badge tone="accent" size="sm" uppercase={false}>Владелец</Badge> : null}
            {member.is_moderator ? <Badge tone="neutral" size="sm" uppercase={false}>Модератор</Badge> : null}
            <span>
              Сообщений: {member.activity.messages} · Реакций: {member.activity.reactions}
            </span>
          </div>
          <span className="text-xs text-muted">Последняя активность: {formatDateTime(member.activity.last_activity)}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col gap-2">
          {member.products.length === 0 ? (
            <span className="text-xs text-muted">Продукты не назначены.</span>
          ) : (
            member.products.map((product: GroupMemberProduct) => (
              <div key={product.product_id} className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
                <Badge tone="accent" size="sm" uppercase={false} title={`Статус: ${PRODUCT_STATUS_LABELS[product.status]}`}>
                  {product.product_title}
                </Badge>
                <span className="text-muted">{PRODUCT_STATUS_LABELS[product.status]}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeProduct.mutate(product.product_id)}
                  disabled={removeProduct.isPending}
                  className="px-2"
                >
                  Удалить
                </Button>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 grid gap-2">
          <Field
            label={
              <>
                <TermHint label="Слаг продукта" description={SLUG_HINT} />
                <span className="text-xs text-muted">(регистр важен)</span>
              </>
            }
          >
            <Input
              value={assignSlug}
              onChange={(event) => setAssignSlug(event.target.value)}
              placeholder="focus-bootcamp"
              disabled={assignProduct.isPending}
            />
          </Field>
          <Field label="Статус">
            <Select
              value={assignStatus}
              onChange={(event) => setAssignStatus(event.target.value as CrmProductStatus)}
              disabled={assignProduct.isPending}
            >
              {PRODUCT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Источник (опционально)">
            <Input
              value={assignSource}
              onChange={(event) => setAssignSource(event.target.value)}
              placeholder="Лендинг, лид-форма, партнёр"
              disabled={assignProduct.isPending}
            />
          </Field>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                if (!assignSlug.trim()) {
                  setError('Укажите слаг продукта.');
                  setFeedback(null);
                  return;
                }
                assignProduct.mutate();
              }}
              disabled={assignProduct.isPending}
            >
              {assignProduct.isPending ? 'Назначаем…' : 'Назначить продукт'}
            </Button>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <Field
          label={<TermHint label="Пробный доступ до" description={TRIAL_HINT} />}
          className="max-w-[160px]"
        >
          <Input
            type="date"
            value={trial}
            onChange={(event) => setTrial(event.target.value)}
            disabled={updateProfile.isPending}
          />
        </Field>
        <Field label={<TermHint label="Теги" description={TAGS_HINT} />}>
          <Textarea
            rows={2}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="cohort-2025, vip, webinar"
            disabled={updateProfile.isPending}
          />
        </Field>
        <Field label="Заметка CRM">
          <Textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Статус оплаты, договорённости, фоллоу-ап"
            disabled={updateProfile.isPending}
          />
        </Field>
        <div className="mt-2 flex items-center justify-end gap-3">
          {feedback ? <span className="text-xs text-emerald-600">{feedback}</span> : null}
          {error ? <span className="text-xs text-red-500">{error}</span> : null}
          <Button type="button" onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? 'Сохраняем…' : 'Сохранить профиль'}
          </Button>
        </div>
        {pending ? <span className="mt-1 block text-[0.65rem] uppercase tracking-wide text-muted">Операция выполняется…</span> : null}
      </td>
    </tr>
  );
}

interface GroupPrunePanelProps {
  groupId: number;
  products: GroupProductSummary[];
  onRefetch: () => void;
}

function GroupPrunePanel({ groupId, products, onRefetch }: GroupPrunePanelProps) {
  const [productSlug, setProductSlug] = useState(products[0]?.slug ?? '');
  const [reason, setReason] = useState('');
  const [lastResult, setLastResult] = useState<GroupPruneResponse | null>(null);
  const pruneMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const payload = {
        product_slug: productSlug || undefined,
        dry_run: dryRun,
        reason: reason.trim() || undefined,
      };
      return apiFetch<GroupPruneResponse>(`/api/v1/groups/${groupId}/prune`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data, dryRun) => {
      setLastResult(data);
      if (!dryRun) {
        onRefetch();
      }
    },
  });

  const hasProducts = products.length > 0;
  const statusMessage = pruneMutation.isPending
    ? 'Выполняем запрос к Telegram…'
    : lastResult
    ? lastResult.dry_run
      ? `Найдено кандидатов: ${lastResult.total_candidates}`
      : `Удалено участников: ${(lastResult.removed ?? []).length}`
    : null;

  return (
    <Card className="flex flex-col gap-4 border-subtle bg-[var(--surface-0)] p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Массовое удаление «непокупателей»</h2>
        <p className="text-sm text-muted">
          Выберите продукт: система покажет кандидатов без статуса <code className="rounded bg-surface-soft px-1">paid</code> и при необходимости удалит их из Telegram.
        </p>
      </header>
      {hasProducts ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
          <Field label="Продукт">
            <Select value={productSlug} onChange={(event) => setProductSlug(event.target.value)} disabled={pruneMutation.isPending}>
              {products.map((product) => (
                <option key={product.id} value={product.slug}>
                  {product.title} ({product.slug})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Комментарий для журнала (опционально)">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Например: окончание пробного периода"
              disabled={pruneMutation.isPending}
            />
          </Field>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => pruneMutation.mutate(true)} disabled={pruneMutation.isPending}>
              {pruneMutation.isPending ? 'Запрашиваем…' : 'Предпросмотр кандидатов'}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => pruneMutation.mutate(false)}
              disabled={pruneMutation.isPending}
            >
              {pruneMutation.isPending ? 'Удаляем…' : 'Удалить из Telegram'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Нет продуктов для отбора. Сначала назначьте хотя бы один продукт участникам.</p>
      )}
      {statusMessage ? <span className="text-xs text-muted">{statusMessage}</span> : null}
      {lastResult ? (
        <div className="rounded-2xl border border-subtle bg-surface-soft px-4 py-3 text-sm text-[var(--text-primary)]">
          {lastResult.dry_run ? (
            <>
              <p>Кандидаты ({lastResult.total_candidates}):</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {(lastResult.candidates ?? []).map((candidate) => (
                  <li key={candidate.user_id}>{candidate.display_name}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p>Удалено участников: {(lastResult.removed ?? []).length}.</p>
              {lastResult.failed && lastResult.failed.length > 0 ? (
                <p className="mt-1 text-red-500">Не удалось удалить: {lastResult.failed.length}. Проверьте лог действий.</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}

interface GroupDetailModuleProps {
  groupId: number;
}

export default function GroupDetailModule({ groupId }: GroupDetailModuleProps) {
  const query = useGroupDetail(groupId);
  const detail = query.data;
  const error = query.error as unknown;
  const errorMessage = error
    ? error instanceof ApiError
      ? error.message
      : 'Не удалось загрузить данные группы.'
    : null;

  const groupTitle = detail?.group.title ?? 'Группа';
  const participantsCount = detail?.group.participants_count ?? 0;
  const products = detail?.products ?? [];
  const members = useMemo(() => detail?.members ?? [], [detail?.members]);

  return (
    <PageLayout
      title={groupTitle}
      description={MODULE_DESCRIPTION}
      contentClassName="flex flex-col gap-6"
    >
      {query.isLoading ? (
        <Card className="h-40 animate-pulse bg-surface-soft" />
      ) : errorMessage ? (
        <Card className="border-red-200 bg-red-50 text-sm text-red-600" role="alert">
          {errorMessage}
        </Card>
      ) : detail ? (
        <>
          <Card className="flex flex-col gap-4 border-subtle bg-[var(--surface-0)] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">{detail.group.title}</h2>
                <p className="text-sm text-muted">Участников: {participantsCount}</p>
              </div>
              <span className="inline-flex items-center gap-2 text-xs text-muted">
                <TermHint
                  label={<span className="underline decoration-dotted underline-offset-4">Telegram ID</span>}
                  description={TELEGRAM_ID_HINT}
                  icon={false}
                  className="text-xs text-muted"
                />
                <code className="rounded-full bg-surface-soft px-2 py-0.5 font-mono text-[0.75rem] text-muted">
                  {detail.group.telegram_id}
                </code>
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <section className="rounded-2xl border border-subtle bg-surface-soft p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Продукты</h3>
                {products.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">Нет продуктов в CRM.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {products.map((product) => (
                      <li key={product.id} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{product.title}</p>
                          <p className="text-xs text-muted">{product.slug}</p>
                        </div>
                        <span className="text-xs text-muted">
                          {product.buyers}/{product.total_members} оплатили
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="rounded-2xl border border-subtle bg-surface-soft p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Лидборд активности (30 дней)</h3>
                {detail.leaderboard.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">Активность пока не зафиксирована.</p>
                ) : (
                  <ol className="mt-2 space-y-2 text-sm">
                    {detail.leaderboard.slice(0, 5).map((entry, index) => (
                      <li key={entry.user_id} className="flex justify-between gap-3">
                        <span>
                          {index + 1}. {entry.display_name}
                        </span>
                        <span className="text-xs text-muted">
                          {entry.messages} сообщений · {entry.reactions} реакций
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <section className="rounded-2xl border border-subtle bg-surface-soft p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">История удалений</h3>
                {detail.removal_history.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">Журнал пуст.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {detail.removal_history.slice(0, 5).map((log) => (
                      <li key={log.id}>
                        <span className="text-[var(--text-primary)]">{log.display_name}</span>
                        <span className="text-xs text-muted">
                          {' '}
                          {formatDateTime(log.created_at)} · {log.result}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </Card>

          <GroupPrunePanel groupId={groupId} products={products} onRefetch={() => query.refetch()} />

          <Card padded={false} className="overflow-hidden" data-testid="group-members-table">
            {members.length === 0 ? (
              <EmptyState
                title="Нет участников"
                description="Убедитесь, что бот подключён к чату и данные синхронизировались."
                icon="👥"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
                  <thead className="bg-surface-soft text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="w-64 px-4 py-3 font-medium">Участник</th>
                      <th className="w-80 px-4 py-3 font-medium">Продукты и назначение</th>
                      <th className="px-4 py-3 font-medium">CRM-профиль</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <GroupMemberRow
                        key={member.telegram_id}
                        groupId={groupId}
                        member={member}
                        products={products}
                        onRefetch={() => query.refetch()}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </PageLayout>
  );
}
