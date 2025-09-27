'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import PageLayout from '../PageLayout';
import { ApiError, apiFetch } from '../../lib/api';
import type { ProfileListItem } from '../../lib/types';
import { Card, EmptyState, Field, Input, TermHint, Toolbar } from '../ui';

const MODULE_TITLE = 'Продукты';
const MODULE_DESCRIPTION = 'Каталог курсов, программ и сервисов Intelligent Data Pro. Здесь формируются карточки для CRM и витрины.';
const PRODUCT_SLUG_HINT =
  'Слаг продукта формирует URL, интеграции и связи с группами. Используйте короткое имя латиницей, например data-cohort-2025.';

function useProductsCatalog() {
  return useQuery<ProfileListItem[]>({
    queryKey: ['products', 'catalog'],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: () => apiFetch<ProfileListItem[]>('/api/v1/profiles/products?limit=200'),
  });
}

export default function ProductsCatalogModule() {
  const [search, setSearch] = useState('');
  const productsQuery = useProductsCatalog();
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return products;
    }
    return products.filter((item) => {
      const headline = (item.headline ?? '').toLowerCase();
      const summary = (item.summary ?? '').toLowerCase();
      return (
        item.display_name.toLowerCase().includes(query) ||
        headline.includes(query) ||
        summary.includes(query) ||
        item.slug.toLowerCase().includes(query)
      );
    });
  }, [products, search]);

  const loadError = productsQuery.error as unknown;
  const loadMessage = loadError
    ? loadError instanceof ApiError
      ? loadError.message
      : 'Не удалось загрузить продукты.'
    : null;

  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION} contentClassName="flex flex-col gap-6">
      <Toolbar className="flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <Field label="Поиск" className="w-full md:max-w-sm">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Название, описание или слаг продукта"
          />
        </Field>
        <span className="text-sm text-muted">Всего: {products.length}</span>
      </Toolbar>

      {loadMessage ? (
        <Card className="border-red-200 bg-red-50 text-sm text-red-600" role="alert">
          {loadMessage}
        </Card>
      ) : null}

      {productsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="h-40 animate-pulse bg-surface-soft" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Ничего не найдено"
          description="Попробуйте изменить поисковый запрос или добавьте продукт через CRM."
          icon="🛍️"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <Card key={product.slug} as="article" className="flex flex-col gap-3">
              <header className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{product.display_name}</h2>
                {product.headline ? <p className="text-sm text-muted">{product.headline}</p> : null}
              </header>
              {product.summary ? <p className="text-sm text-[var(--text-primary)]">{product.summary}</p> : null}
              <span className="inline-flex items-center gap-2 text-xs text-muted">
                <TermHint
                  label={<span className="underline decoration-dotted underline-offset-4">Слаг</span>}
                  description={PRODUCT_SLUG_HINT}
                  icon={false}
                  className="text-xs text-muted"
                />
                <code className="rounded-full bg-surface-soft px-2 py-0.5 font-mono text-[0.7rem]">{product.slug}</code>
              </span>
              <div className="mt-auto flex items-center justify-between">
                <Link
                  href={`/products/${product.slug}`}
                  prefetch={false}
                  className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)] hover:underline"
                >
                  Открыть профиль
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
