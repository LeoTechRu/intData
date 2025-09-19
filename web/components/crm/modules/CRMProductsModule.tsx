'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import PageLayout from '../../PageLayout';
import { apiFetch, ApiError } from '../../../lib/api';
import { Card, EmptyState, Field, Input, TermHint, Toolbar, Button, Select } from '../../ui';

const MODULE_TITLE = 'CRM · Продукты, тарифы и потоки';
const MODULE_DESCRIPTION =
  'Каталог курсов, сервисов и программ Intelligent Data Pro. Каждая карточка привязана к PARA и содержит тарифы, потоки (версии) и сценарии переходов.';

interface CRMProductVersion {
  id: number;
  slug: string;
  title: string;
  pricing_mode: string;
  starts_at: string | null;
  ends_at: string | null;
  seats_limit: number | null;
  area_id: number | null;
  project_id: number | null;
  config: Record<string, unknown>;
}

interface CRMTariff {
  id: number;
  slug: string;
  title: string;
  billing_type: string;
  amount: number | null;
  currency: string;
  is_active: boolean;
  version_id: number | null;
  config: Record<string, unknown>;
}

interface CRMProductItem {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  kind: string;
  area_id: number | null;
  project_id: number | null;
  is_active: boolean;
  config: Record<string, unknown>;
  versions: CRMProductVersion[];
  tariffs: CRMTariff[];
}

interface SubscriptionTransitionResponse {
  subscription_id: number;
  status: string;
  transition_type: string;
}

function useCrmProducts() {
  return useQuery<CRMProductItem[]>({
    queryKey: ['crm', 'products'],
    queryFn: () => apiFetch<CRMProductItem[]>('/api/v1/crm/products'),
    staleTime: 60_000,
  });
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

const TRANSITION_LABELS: Record<string, string> = {
  free: 'Бесплатный доступ',
  upgrade: 'Платный апгрейд',
  downgrade: 'Переход на более простой тариф',
};

export default function CRMProductsModule() {
  const [search, setSearch] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [transitionType, setTransitionType] = useState<'free' | 'upgrade' | 'downgrade'>('free');
  const [webUserId, setWebUserId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');

  const productsQuery = useCrmProducts();
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) {
      return products;
    }
    return products.filter((product) => {
      return (
        product.title.toLowerCase().includes(text) ||
        (product.summary ?? '').toLowerCase().includes(text) ||
        product.slug.toLowerCase().includes(text)
      );
    });
  }, [products, search]);

  const selected = useMemo(() => {
    if (!filtered.length) {
      return null;
    }
    const slug = selectedSlug ?? filtered[0]?.slug;
    return filtered.find((product) => product.slug === slug) ?? filtered[0];
  }, [filtered, selectedSlug]);

  const transitionMutation = useMutation<SubscriptionTransitionResponse, ApiError>({
    mutationFn: async () => {
      if (!selected) {
        throw new ApiError('Выберите продукт', 422);
      }
      const body = {
        product_id: selected.id,
        version_id: selected.versions[0]?.id ?? null,
        tariff_id: selected.tariffs[0]?.id ?? null,
        transition_type: transitionType,
        activation_source: 'crm-products-module',
        metadata: { initiated_by: 'crm-ui' },
        area_id: selected.area_id,
        project_id: selected.project_id,
        web_user_id: webUserId ? Number(webUserId) : null,
        email: email || null,
        phone: phone || null,
        full_name: fullName || null,
      };
      return apiFetch<SubscriptionTransitionResponse>('/api/v1/crm/subscriptions/transition', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  });

  const transitionMessage = transitionMutation.data
    ? `Подписка #${transitionMutation.data.subscription_id} → статус ${transitionMutation.data.status}`
    : transitionMutation.error?.message;

  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION} contentClassName="flex flex-col gap-6">
      <Toolbar className="flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Field label="Поиск по каталогу" className="w-full lg:max-w-sm">
          <Input
            type="search"
            placeholder="Название, описание или слаг"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>Всего продуктов: {products.length}</span>
          <TermHint
            label="PARA связка"
            description="Каждый продукт наследует Area/Project. Это обеспечивает синхронизацию с заметками и программами обучения."
          />
        </div>
      </Toolbar>

      {productsQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="h-40 animate-pulse bg-surface-soft" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📦"
          title="Каталог пуст"
          description="Добавьте первый продукт через серверный seed или форму CRM."
        />
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          <Card className="w-full flex-1 space-y-3 lg:max-w-xs">
            <header className="space-y-1">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Продукты</h2>
              <p className="text-sm text-muted">
                Список основных предложений Intelligent Data Pro. Выберите продукт, чтобы настроить тарифы, потоки и переходы.
              </p>
            </header>
            <div className="space-y-2">
              {filtered.map((product) => {
                const isSelected = selected?.slug === product.slug;
                return (
                  <button
                    key={product.slug}
                    type="button"
                    onClick={() => setSelectedSlug(product.slug)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-base ${
                      isSelected
                        ? 'border-[var(--accent-primary)] bg-[var(--surface-soft)]'
                        : 'border-subtle hover:border-[var(--accent-primary)] hover:bg-[var(--surface-1)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{product.title}</span>
                      {!product.is_active ? (
                        <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs text-muted">архив</span>
                      ) : null}
                    </div>
                    {product.summary ? <p className="mt-1 text-xs text-muted">{product.summary}</p> : null}
                    <code className="mt-2 inline-flex rounded bg-surface-soft px-2 py-0.5 text-[0.7rem] text-muted">{product.slug}</code>
                  </button>
                );
              })}
            </div>
          </Card>

          {selected ? (
            <div className="flex w-full flex-1 flex-col gap-6">
              <Card className="space-y-3">
                <header className="space-y-1">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">{selected.title}</h2>
                  {selected.summary ? <p className="text-sm text-muted">{selected.summary}</p> : null}
                </header>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-xs uppercase text-muted">Вид продукта</span>
                    <p className="text-sm text-[var(--text-primary)]">{selected.kind}</p>
                  </div>
                  <div>
                    <span className="text-xs uppercase text-muted">PARA</span>
                    <p className="text-sm text-[var(--text-primary)]">
                      {selected.project_id ? `Project #${selected.project_id}` : selected.area_id ? `Area #${selected.area_id}` : 'Не задано'}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="space-y-4">
                <header className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Потоки и версии</h3>
                    <p className="text-sm text-muted">Отражают наборы запусков: когорты курсов, релизы продукта или версии подписки.</p>
                  </div>
                  <TermHint
                    label="Pricing mode"
                    description="cohort — ограниченные потоки, rolling — потоковые наборы, perpetual — бессрочный доступ."
                  />
                </header>
                {selected.versions.length === 0 ? (
                  <EmptyState
                    icon="🚀"
                    title="Нет потоков"
                    description="Добавьте первую версию курса или релиз через API /crm/products."
                  />
                ) : (
                  <div className="space-y-3">
                    {selected.versions.map((version) => (
                      <div key={version.id} className="rounded-xl border border-subtle p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-[var(--text-primary)]">{version.title}</h4>
                            <p className="text-xs text-muted">{version.slug}</p>
                          </div>
                          <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs text-muted">{version.pricing_mode}</span>
                        </div>
                        <dl className="mt-2 grid gap-2 text-xs text-muted sm:grid-cols-3">
                          <div>
                            <dt className="font-medium text-[var(--text-primary)]">Старт</dt>
                            <dd>{formatDate(version.starts_at)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-[var(--text-primary)]">Финиш</dt>
                            <dd>{formatDate(version.ends_at)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-[var(--text-primary)]">Лимит мест</dt>
                            <dd>{version.seats_limit ?? 'Без ограничений'}</dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="space-y-4">
                <header className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Тарифы и переходы</h3>
                    <p className="text-sm text-muted">Настройте пакеты для продаж и переводов между версиями.</p>
                  </div>
                  <TermHint
                    label="Переходы"
                    description="Для апгрейда/даунгрейда создаётся событие подписки и запись в журнале CRM."
                  />
                </header>
                {selected.tariffs.length === 0 ? (
                  <EmptyState
                    icon="💳"
                    title="Тарифы не заданы"
                    description="Заведите тарифы через API /crm/products — это позволит управлять оплатой и апгрейдами."
                  />
                ) : (
                  <div className="space-y-3">
                    {selected.tariffs.map((tariff) => (
                      <div key={tariff.id} className="rounded-xl border border-subtle p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-[var(--text-primary)]">{tariff.title}</h4>
                            <p className="text-xs text-muted">{tariff.slug}</p>
                          </div>
                          <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs text-muted">
                            {tariff.billing_type}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--text-primary)]">
                          {tariff.amount ? `${tariff.amount} ${tariff.currency}` : 'Бесплатно'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  className="mt-4 grid gap-3 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    transitionMutation.mutate();
                  }}
                >
                  <Field label="Тип перехода" className="md:col-span-2">
                    <Select value={transitionType} onChange={(event) => setTransitionType(event.target.value as typeof transitionType)}>
                      <option value="free">{TRANSITION_LABELS.free}</option>
                      <option value="upgrade">{TRANSITION_LABELS.upgrade}</option>
                      <option value="downgrade">{TRANSITION_LABELS.downgrade}</option>
                    </Select>
                  </Field>
                  <Field label="web_user_id">
                    <Input value={webUserId} onChange={(event) => setWebUserId(event.target.value)} placeholder="Например, 42" />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="client@example.com" />
                  </Field>
                  <Field label="Телефон">
                    <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+71234567890" />
                  </Field>
                  <Field label="Имя клиента">
                    <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Имя Фамилия" />
                  </Field>
                  <div className="md:col-span-2 flex flex-col gap-2">
                    <Button type="submit" disabled={transitionMutation.isPending}>
                      {transitionMutation.isPending ? 'Сохраняем…' : 'Запустить переход'}
                    </Button>
                    {transitionMessage ? (
                      <p className={`text-sm ${transitionMutation.error ? 'text-red-600' : 'text-[var(--accent-primary)]'}`}>
                        {transitionMessage}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted">
                      Если заполнен web_user_id — используем его. Иначе создаём или находим клиента по email/телефону в users_web.
                    </p>
                  </div>
                </form>
              </Card>
            </div>
          ) : null}
        </div>
      )}
    </PageLayout>
  );
}
