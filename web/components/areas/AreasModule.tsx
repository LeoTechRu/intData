'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import PageLayout from '../PageLayout';
import { apiFetch, ApiError } from '../../lib/api';
import type { Area } from '../../lib/types';
import { buildAreaOptions } from '../../lib/areas';

const MODULE_TITLE = 'Области';
const MODULE_DESCRIPTION =
  'Структурируйте сферы ответственности, создавайте вложенные области и управляйте деревом PARA.';

type CreatePayload = {
  name: string;
  color?: string | null;
  parent_id?: number | null;
};

type MovePayload = {
  areaId: number;
  newParentId: number | null;
};

type RenamePayload = {
  areaId: number;
  newName: string;
};

interface CreateFormState {
  name: string;
  parentId: string;
  color: string;
}

interface DetailState {
  rename: string;
  parentId: string;
}

function sortAreas(areas: Area[]): Area[] {
  return [...areas].sort((a, b) => {
    const pathA = a.mp_path ?? '';
    const pathB = b.mp_path ?? '';
    if (pathA === pathB) {
      return a.name.localeCompare(b.name);
    }
    return pathA.localeCompare(pathB);
  });
}

function isDescendant(candidate: Area, ancestor: Area): boolean {
  if (candidate.id === ancestor.id) {
    return false;
  }
  const candidatePath = candidate.mp_path ?? '';
  const ancestorPath = ancestor.mp_path ?? '';
  if (!candidatePath || !ancestorPath) {
    return false;
  }
  return candidatePath.startsWith(ancestorPath) && candidatePath !== ancestorPath;
}

export default function AreasModule() {
  const areasQuery = useQuery<Area[]>({
    queryKey: ['areas'],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: () => apiFetch<Area[]>('/api/v1/areas'),
  });

  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormState>({ name: '', parentId: '', color: '#F1F5F9' });
  const [detailState, setDetailState] = useState<DetailState>({ rename: '', parentId: '' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailMessage, setDetailMessage] = useState<string | null>(null);

  const areas = useMemo(() => areasQuery.data ?? [], [areasQuery.data]);
  const sortedAreas = useMemo(() => sortAreas(areas), [areas]);
  const areaOptions = useMemo(() => buildAreaOptions(areas), [areas]);
  const selectedArea = useMemo(
    () => areas.find((area) => area.id === selectedAreaId) ?? null,
    [areas, selectedAreaId],
  );

  useEffect(() => {
    if (!selectedAreaId && sortedAreas.length > 0) {
      setSelectedAreaId(sortedAreas[0].id);
    }
  }, [sortedAreas, selectedAreaId]);

  useEffect(() => {
    if (!selectedArea) {
      setDetailState({ rename: '', parentId: '' });
      setDetailMessage(null);
      setDetailError(null);
      return;
    }
    setDetailState({
      rename: selectedArea.name,
      parentId: selectedArea.parent_id ? String(selectedArea.parent_id) : '',
    });
    setDetailMessage(null);
    setDetailError(null);
  }, [selectedArea]);

  const { refetch } = areasQuery;

  const createMutation = useMutation({
    mutationFn: async (payload: CreatePayload) => {
      return apiFetch<Area>('/api/v1/areas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async (area) => {
      setCreateError(null);
      setCreateForm({ name: '', parentId: createForm.parentId, color: '#F1F5F9' });
      setSelectedAreaId(area.id);
      await refetch();
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        const detail = typeof error.info === 'object' && error.info !== null ? (error.info as any).detail : null;
        setCreateError(detail ?? error.message);
        return;
      }
      setCreateError('Не удалось создать область');
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ areaId, newName }: RenamePayload) => {
      return apiFetch<Area>(`/api/v1/areas/${areaId}/rename`, {
        method: 'POST',
        body: JSON.stringify({ name: newName }),
      });
    },
    onSuccess: async () => {
      setDetailError(null);
      setDetailMessage('Название обновлено');
      await refetch();
    },
    onError: (error: unknown) => {
      setDetailMessage(null);
      if (error instanceof ApiError) {
        const detail = typeof error.info === 'object' && error.info !== null ? (error.info as any).detail : null;
        setDetailError(detail ?? error.message);
        return;
      }
      setDetailError('Не удалось переименовать область');
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ areaId, newParentId }: MovePayload) => {
      return apiFetch<Area>(`/api/v1/areas/${areaId}/move`, {
        method: 'POST',
        body: JSON.stringify({ new_parent_id: newParentId }),
      });
    },
    onSuccess: async () => {
      setDetailError(null);
      setDetailMessage('Область перемещена');
      await refetch();
    },
    onError: (error: unknown) => {
      setDetailMessage(null);
      if (error instanceof ApiError) {
        const detail = typeof error.info === 'object' && error.info !== null ? (error.info as any).detail : null;
        setDetailError(detail ?? error.message);
        return;
      }
      setDetailError('Не удалось переместить область');
    },
  });

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.name.trim()) {
      setCreateError('Введите название области');
      return;
    }
    const payload: CreatePayload = {
      name: createForm.name.trim(),
      color: createForm.color?.trim() || null,
      parent_id: createForm.parentId ? Number(createForm.parentId) : null,
    };
    createMutation.mutate(payload);
  };

  const handleRenameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedArea) {
      return;
    }
    if (!detailState.rename.trim()) {
      setDetailError('Название не может быть пустым');
      return;
    }
    renameMutation.mutate({ areaId: selectedArea.id, newName: detailState.rename.trim() });
  };

  const handleMoveSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedArea) {
      return;
    }
    const newParentId = detailState.parentId ? Number(detailState.parentId) : null;
    moveMutation.mutate({ areaId: selectedArea.id, newParentId });
  };

  const loadError = areasQuery.error as unknown;
  const loadErrorMessage = loadError
    ? loadError instanceof ApiError
      ? loadError.message
      : 'Не удалось загрузить данные'
    : null;

  const isLoading = areasQuery.isLoading;

  const availableParentOptions = useMemo(() => {
    if (!selectedArea) {
      return areaOptions;
    }
    return areaOptions.filter((option) => {
      const candidate = areas.find((area) => area.id === option.id);
      if (!candidate) {
        return false;
      }
      if (candidate.id === selectedArea.id) {
        return false;
      }
      if (isDescendant(candidate, selectedArea)) {
        return false;
      }
      return true;
    });
  }, [areaOptions, areas, selectedArea]);

  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION}>
      <section className="grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-subtle bg-surface-soft p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Дерево областей</h2>
            {isLoading ? (
              <ul className="mt-4 space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <li key={index} className="h-4 w-full animate-pulse rounded-full bg-surface" />
                ))}
              </ul>
            ) : sortedAreas.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Пока нет областей — создайте первую область для структуры PARA.</p>
            ) : (
              <ul className="mt-4 space-y-1">
                {sortedAreas.map((area) => {
                  const depth = area.depth ?? 0;
                  const isActive = area.id === selectedAreaId;
                  return (
                    <li key={area.id}>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] ${
                          isActive ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] shadow-soft' : 'text-[var(--text-primary)] hover:bg-[var(--surface-0)]'
                        }`}
                        style={{ paddingLeft: `${12 + depth * 16}px` }}
                        onClick={() => setSelectedAreaId(area.id)}
                        data-testid={`area-node-${area.id}`}
                      >
                        <span className="flex items-center gap-2">
                          {area.color ? (
                            <span
                              aria-hidden
                              className="inline-flex h-3 w-3 rounded-full border border-white/40"
                              style={{ backgroundColor: area.color }}
                            />
                          ) : null}
                          {area.name}
                        </span>
                        <span className="text-xs text-muted">#{area.id}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-subtle bg-surface-soft p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Новая область</h2>
            <form className="mt-4 flex flex-col gap-4" onSubmit={handleCreateSubmit}>
              <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="create-area-name">
                Название новой области
                <input
                  id="create-area-name"
                  type="text"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Например, Здоровье"
                  className="rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="create-area-parent">
                Родительская область
                <select
                  id="create-area-parent"
                  value={createForm.parentId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, parentId: event.target.value }))}
                  className="rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                >
                  <option value="">— верхний уровень —</option>
                  {areaOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="create-area-color">
                Цвет (HEX)
                <input
                  id="create-area-color"
                  type="text"
                  value={createForm.color}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, color: event.target.value }))}
                  className="rounded-xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                  placeholder="#F1F5F9"
                />
              </label>
              {createError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{createError}</div>
              ) : null}
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--accent-on-primary)] transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] disabled:cursor-progress disabled:opacity-70"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Создаём…' : 'Добавить область'}
              </button>
            </form>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {loadErrorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{loadErrorMessage}</div>
          ) : null}

          <div className="rounded-2xl border border-subtle bg-[var(--surface-0)] p-6">
            {!selectedArea ? (
              <p className="text-sm text-muted">Выберите область в списке слева, чтобы увидеть подробности.</p>
            ) : (
              <div className="flex flex-col gap-5">
                <header className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Область</span>
                  <h2 className="text-xl font-semibold text-[var(--text-primary)]">{selectedArea.name}</h2>
                  <p className="text-xs text-muted">ID #{selectedArea.id} · slug {selectedArea.slug || '—'}</p>
                </header>

                <form className="flex flex-col gap-3 rounded-xl border border-subtle bg-surface-soft p-4" onSubmit={handleRenameSubmit}>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Переименовать</h3>
                  <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="rename-area-name">
                    Новое название
                    <input
                      id="rename-area-name"
                      type="text"
                      value={detailState.rename}
                      onChange={(event) => setDetailState((prev) => ({ ...prev, rename: event.target.value }))}
                      className="rounded-lg border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--accent-on-primary)] transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] disabled:cursor-progress disabled:opacity-70"
                    disabled={renameMutation.isPending}
                  >
                    {renameMutation.isPending ? 'Сохраняем…' : 'Сохранить'}
                  </button>
                </form>

                <form className="flex flex-col gap-3 rounded-xl border border-subtle bg-surface-soft p-4" onSubmit={handleMoveSubmit}>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Переместить</h3>
                  <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="move-area-parent">
                    Переместить в
                    <select
                      id="move-area-parent"
                      value={detailState.parentId}
                      onChange={(event) => setDetailState((prev) => ({ ...prev, parentId: event.target.value }))}
                      className="rounded-lg border border-subtle bg-[var(--surface-0)] px-3 py-2 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                    >
                      <option value="">— верхний уровень —</option>
                      {availableParentOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-[var(--accent-on-primary)] transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] disabled:cursor-progress disabled:opacity-70"
                    disabled={moveMutation.isPending}
                  >
                    {moveMutation.isPending ? 'Перемещаем…' : 'Переместить'}
                  </button>
                </form>

                {detailError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{detailError}</div>
                ) : null}
                {detailMessage ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{detailMessage}</div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
