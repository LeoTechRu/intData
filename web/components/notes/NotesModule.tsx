'use client';

import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import PageLayout from '../PageLayout';
import { buildAreaOptions } from '../../lib/areas';
import {
  apiFetch,
  ApiError,
  buildQuery,
} from '../../lib/api';
import type {
  Area,
  Note,
  Project,
} from '../../lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  Toolbar,
} from '../ui';
import { Modal } from '../../ui/uikit/Modal';
import { SortableNoteCard } from './SortableNoteCard';

const MODULE_TITLE = 'Заметки';
const MODULE_DESCRIPTION =
  'Фиксируйте идеи и рабочие заметки, организуйте их по областям и проектам, закрепляйте важное и управляйте порядком карточек.';

interface NoteFilters {
  areaId: string;
  projectId: string;
  search: string;
  onlyPinned: boolean;
  includeArchived: boolean;
}

interface QuickNoteState {
  title: string;
  content: string;
  areaId: string;
  projectId: string;
  pinned: boolean;
}

interface NoteEditorState {
  id: number;
  title: string;
  content: string;
  areaId: string;
  projectId: string;
  pinned: boolean;
  color: string;
}

function findInboxArea(areas: Area[]): Area | null {
  const inboxSlug = areas.find((area) => (area.slug || '').toLowerCase() === 'inbox');
  if (inboxSlug) {
    return inboxSlug;
  }
  const variants = ['входящие', 'inbox', 'incoming'];
  return (
    areas.find((area) => variants.some((variant) => area.name.toLowerCase().includes(variant))) || null
  );
}

function useAreas() {
  return useQuery<Area[]>({
    queryKey: ['areas'],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: () => apiFetch<Area[]>('/api/v1/areas'),
  });
}

function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects', 'all'],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: () => apiFetch<Project[]>('/api/v1/projects'),
  });
}

function useNotes(filters: NoteFilters) {
  return useQuery<Note[]>({
    queryKey: ['notes', filters],
    staleTime: 15_000,
    gcTime: 120_000,
    queryFn: () => {
      const qs = buildQuery({
        area_id: filters.areaId || undefined,
        project_id: filters.projectId || undefined,
        pinned: filters.onlyPinned ? true : undefined,
        archived: filters.includeArchived ? true : undefined,
        q: filters.search.trim() || undefined,
      });
      return apiFetch<Note[]>(`/api/v1/notes${qs}`);
    },
  });
}

function mapProjectsByArea(projects: Project[]): Map<number, Project[]> {
  const result = new Map<number, Project[]>();
  projects.forEach((project) => {
    const list = result.get(project.area_id);
    if (list) {
      list.push(project);
    } else {
      result.set(project.area_id, [project]);
    }
  });
  return result;
}

export default function NotesModule() {
  const queryClient = useQueryClient();
  const areasQuery = useAreas();
  const projectsQuery = useProjects();

  const [filtersDraft, setFiltersDraft] = useState<NoteFilters>({
    areaId: '',
    projectId: '',
    search: '',
    onlyPinned: false,
    includeArchived: false,
  });
  const [filters, setFilters] = useState<NoteFilters>(filtersDraft);
  const [quickNote, setQuickNote] = useState<QuickNoteState>({
    title: '',
    content: '',
    areaId: '',
    projectId: '',
    pinned: false,
  });
  const [quickError, setQuickError] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<NoteEditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);

  const notesQuery = useNotes(filters);

  const areaOptions = useMemo(() => buildAreaOptions(areasQuery.data ?? []), [areasQuery.data]);
  const projectsByArea = useMemo(() => mapProjectsByArea(projectsQuery.data ?? []), [projectsQuery.data]);

  useEffect(() => {
    if (!quickNote.areaId && areaOptions.length > 0) {
      const inbox = findInboxArea(areasQuery.data ?? []);
      const fallback = (inbox?.id ?? areaOptions[0]?.id)?.toString() ?? '';
      if (fallback) {
        setQuickNote((prev) => ({ ...prev, areaId: fallback }));
      }
    }
  }, [areaOptions, areasQuery.data, quickNote.areaId]);

  const filteredProjectsForFilters = useMemo(() => {
    if (!filtersDraft.areaId) {
      return projectsQuery.data ?? [];
    }
    const areaId = Number(filtersDraft.areaId);
    return projectsByArea.get(areaId) ?? [];
  }, [filtersDraft.areaId, projectsByArea, projectsQuery.data]);

  const filteredProjectsForEditor = useMemo(() => {
    if (!editorState?.areaId) return [] as Project[];
    const areaId = Number(editorState.areaId);
    return projectsByArea.get(areaId) ?? [];
  }, [editorState?.areaId, projectsByArea]);

  const filteredProjectsForQuick = useMemo(() => {
    if (!quickNote.areaId) return [] as Project[];
    const areaId = Number(quickNote.areaId);
    return projectsByArea.get(areaId) ?? [];
  }, [projectsByArea, quickNote.areaId]);

  const notes = useMemo(() => {
    const data = notesQuery.data ?? [];
    return [...data].sort((a, b) => {
      if (a.pinned === b.pinned) {
        return a.order_index - b.order_index;
      }
      return a.pinned ? -1 : 1;
    });
  }, [notesQuery.data]);

  const sensors = useSensors(useSensor(PointerSensor));

  const createMutation = useMutation({
    mutationFn: (payload: QuickNoteState) =>
      apiFetch<Note>('/api/v1/notes', {
        method: 'POST',
        body: JSON.stringify({
          title: payload.title.trim() || null,
          content: payload.content.trim(),
          area_id: payload.areaId ? Number(payload.areaId) : undefined,
          project_id: payload.projectId ? Number(payload.projectId) : undefined,
          pinned: payload.pinned,
        }),
      }),
    onSuccess: () => {
      setQuickNote((prev) => ({ ...prev, title: '', content: '', pinned: false }));
      setQuickError(null);
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const message =
          typeof error.info === 'object' && error.info && 'detail' in (error.info as Record<string, unknown>)
            ? String((error.info as Record<string, unknown>).detail)
            : error.message;
        setQuickError(message);
        return;
      }
      setQuickError('Не удалось сохранить заметку');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<NoteEditorState> }) =>
      apiFetch<Note>(`/api/v1/notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: changes.title,
          content: changes.content,
          area_id: changes.areaId ? Number(changes.areaId) : undefined,
          project_id: changes.projectId ? Number(changes.projectId) : null,
          pinned: changes.pinned,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setEditorOpen(false);
      setEditorState(null);
      setEditorError(null);
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Не удалось обновить заметку';
      setEditorError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/v1/notes/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      if (editorState) {
        setEditorOpen(false);
        setEditorState(null);
      }
    },
    onError: () => {
      setEditorError('Не удалось удалить заметку');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (payload: { ids: number[]; areaId?: number; projectId?: number }) =>
      apiFetch('/api/v1/notes/reorder', {
        method: 'POST',
        body: JSON.stringify({
          ids: payload.ids,
          area_id: payload.areaId,
          project_id: payload.projectId,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const handleQuickSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quickNote.content.trim()) {
      setQuickError('Напишите текст заметки');
      return;
    }
    createMutation.mutate(quickNote);
  };

  const handleFiltersSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters(filtersDraft);
  };

  const handleOpenEditor = useCallback(
    (note: Note) => {
      setEditorState({
        id: note.id,
        title: note.title ?? '',
        content: note.content,
        areaId: note.area_id.toString(),
        projectId: note.project_id ? note.project_id.toString() : '',
        pinned: note.pinned,
        color: note.color,
      });
      setEditorError(null);
      setEditorOpen(true);
    },
    [setEditorOpen],
  );

  const handleTogglePin = useCallback(
    (note: Note) => {
      updateMutation.mutate({
        id: note.id,
        changes: { pinned: !note.pinned },
      });
    },
    [updateMutation],
  );

  const handleDelete = useCallback(
    (note: Note) => {
      const ok = window.confirm('Удалить заметку? Это действие нельзя отменить.');
      if (!ok) return;
      deleteMutation.mutate(note.id);
    },
    [deleteMutation],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      const currentIndex = notes.findIndex((note) => note.id === Number(active.id));
      const overIndex = notes.findIndex((note) => note.id === Number(over.id));
      if (currentIndex === -1 || overIndex === -1) {
        return;
      }
      const reordered = arrayMove(notes, currentIndex, overIndex);
      queryClient.setQueryData<Note[]>(['notes', filters], reordered);
      reorderMutation.mutate({
        ids: reordered.map((note) => note.id),
        areaId: filters.areaId ? Number(filters.areaId) : undefined,
        projectId: filters.projectId ? Number(filters.projectId) : undefined,
      });
    },
    [filters, notes, queryClient, reorderMutation],
  );

  const handleEditorSave = () => {
    if (!editorState) return;
    const original = notesQuery.data?.find((note) => note.id === editorState.id);
    if (!original) {
      setEditorOpen(false);
      setEditorState(null);
      return;
    }
    const changes: Partial<NoteEditorState> = {};
    if ((editorState.title ?? '') !== (original.title ?? '')) {
      changes.title = editorState.title;
    }
    if (editorState.content !== original.content) {
      changes.content = editorState.content;
    }
    if (Number(editorState.areaId) !== original.area_id) {
      changes.areaId = editorState.areaId;
    }
    const originalProjectId = original.project_id ? original.project_id.toString() : '';
    if (editorState.projectId !== originalProjectId) {
      changes.projectId = editorState.projectId;
    }
    if (editorState.pinned !== original.pinned) {
      changes.pinned = editorState.pinned;
    }
    if (Object.keys(changes).length === 0) {
      setEditorOpen(false);
      setEditorState(null);
      return;
    }
    updateMutation.mutate({ id: editorState.id, changes });
  };

  const isLoading =
    areasQuery.isLoading ||
    projectsQuery.isLoading ||
    notesQuery.isLoading;

  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION}>
      <div className="grid gap-6">
        <Card surface="soft" padded className="flex flex-col gap-4">
          <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" onSubmit={handleQuickSubmit}>
            <div className="flex flex-col gap-4">
              <Field label="Заголовок">
                <Input
                  value={quickNote.title}
                  onChange={(event) => setQuickNote((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Например, «Идеи для обзора»"
                  name="title"
                />
              </Field>
              <Field label="Текст заметки" required>
                <Textarea
                  value={quickNote.content}
                  onChange={(event) => setQuickNote((prev) => ({ ...prev, content: event.target.value }))}
                  placeholder="Фиксируйте мысли, ссылки и рабочие детали."
                  rows={4}
                  name="content"
                  required
                />
              </Field>
            </div>
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Область" required>
                  <Select
                    value={quickNote.areaId}
                    onChange={(event) =>
                      setQuickNote((prev) => ({
                        ...prev,
                        areaId: event.target.value,
                        projectId: '',
                      }))
                    }
                    required
                    name="area_id"
                  >
                    <option value="" disabled>
                      Выберите область
                    </option>
                    {areaOptions.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Проект">
                  <Select
                    value={quickNote.projectId}
                    onChange={(event) =>
                      setQuickNote((prev) => ({ ...prev, projectId: event.target.value }))
                    }
                    name="project_id"
                    disabled={!quickNote.areaId || filteredProjectsForQuick.length === 0}
                  >
                    <option value="">Без проекта</option>
                    {filteredProjectsForQuick.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={quickNote.pinned}
                    onChange={(event) =>
                      setQuickNote((prev) => ({ ...prev, pinned: event.target.checked }))
                    }
                    className="h-4 w-4 rounded-md border border-subtle"
                  />
                  Закрепить заметку
                </label>
                <Button type="submit" disabled={createMutation.isPending}>
                  Сохранить заметку
                </Button>
                {quickError ? <p className="text-sm text-[var(--accent-danger)]">{quickError}</p> : null}
              </div>
            </div>
          </form>
        </Card>

        <Card padded={false}>
          <form onSubmit={handleFiltersSubmit} className="space-y-4 p-6">
            <Toolbar className="gap-4 flex-col lg:flex-row" justify="between">
              <div className="flex flex-wrap items-center gap-3">
                <Field label="Область" className="min-w-[220px]">
                  <Select
                    value={filtersDraft.areaId}
                    onChange={(event) =>
                      setFiltersDraft((prev) => ({
                        ...prev,
                        areaId: event.target.value,
                        projectId: '',
                      }))
                    }
                  >
                    <option value="">Все области</option>
                    {areaOptions.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Проект" className="min-w-[220px]">
                  <Select
                    value={filtersDraft.projectId}
                    onChange={(event) =>
                      setFiltersDraft((prev) => ({ ...prev, projectId: event.target.value }))
                    }
                    disabled={filteredProjectsForFilters.length === 0 && !filtersDraft.projectId}
                  >
                    <option value="">Все проекты</option>
                    {filteredProjectsForFilters.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Field label="Поиск">
                  <Input
                    value={filtersDraft.search}
                    onChange={(event) =>
                      setFiltersDraft((prev) => ({ ...prev, search: event.target.value }))
                    }
                    placeholder="Поиск по содержимому"
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={filtersDraft.onlyPinned}
                    onChange={(event) =>
                      setFiltersDraft((prev) => ({ ...prev, onlyPinned: event.target.checked }))
                    }
                    className="h-4 w-4 rounded-md border border-subtle"
                  />
                  Только закреплённые
                </label>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={filtersDraft.includeArchived}
                    onChange={(event) =>
                      setFiltersDraft((prev) => ({ ...prev, includeArchived: event.target.checked }))
                    }
                    className="h-4 w-4 rounded-md border border-subtle"
                  />
                  Показать архив
                </label>
                <Button type="submit" variant="secondary">
                  Применить фильтры
                </Button>
              </div>
            </Toolbar>
          </form>
          <div className="border-t border-subtle" />
          <div className="p-6">
            {isLoading ? (
              <div className="flex justify-center py-24 text-muted">Загружаем заметки…</div>
            ) : notes.length === 0 ? (
              <EmptyState
                title="Нет заметок"
                description="Создайте первую заметку через форму выше или измените фильтры."
              />
            ) : (
              <DndContext
                sensors={sensors}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={notes.map((note) => note.id)} strategy={verticalListSortingStrategy}>
                  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {notes.map((note) => (
                      <SortableNoteCard
                        key={note.id}
                        note={note}
                        onOpen={handleOpenEditor}
                        onTogglePin={handleTogglePin}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </Card>
      </div>

      <Modal open={isEditorOpen && !!editorState} onClose={() => setEditorOpen(false)}>
        {editorState ? (
          <div className="flex max-h-[80vh] w-[min(640px,90vw)] flex-col gap-4 rounded-2xl bg-[var(--surface-0)] p-6 shadow-lg">
            <header className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Редактирование заметки</h2>
                <p className="text-sm text-muted">Внесите изменения и сохраните, чтобы обновить карточку.</p>
              </div>
              <Badge>{editorState.pinned ? 'Закреплена' : 'Обычная'}</Badge>
            </header>
            <div className="flex flex-col gap-4 overflow-y-auto pr-1">
              <Field label="Заголовок">
                <Input
                  value={editorState.title}
                  onChange={(event) =>
                    setEditorState((prev) =>
                      prev ? { ...prev, title: event.target.value } : prev,
                    )
                  }
                />
              </Field>
              <Field label="Содержимое" required>
                <Textarea
                  value={editorState.content}
                  rows={10}
                  onChange={(event) =>
                    setEditorState((prev) =>
                      prev ? { ...prev, content: event.target.value } : prev,
                    )
                  }
                />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Область" required>
                  <Select
                    value={editorState.areaId}
                    onChange={(event) =>
                      setEditorState((prev) =>
                        prev
                          ? {
                              ...prev,
                              areaId: event.target.value,
                              projectId: '',
                            }
                          : prev,
                      )
                    }
                  >
                    {areaOptions.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Проект">
                  <Select
                    value={editorState.projectId}
                    onChange={(event) =>
                      setEditorState((prev) =>
                        prev ? { ...prev, projectId: event.target.value } : prev,
                      )
                    }
                    disabled={filteredProjectsForEditor.length === 0}
                  >
                    <option value="">Без проекта</option>
                    {filteredProjectsForEditor.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <label className="flex items-center gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={editorState.pinned}
                  onChange={(event) =>
                    setEditorState((prev) =>
                      prev ? { ...prev, pinned: event.target.checked } : prev,
                    )
                  }
                  className="h-4 w-4 rounded-md border border-subtle"
                />
                Закрепить заметку
              </label>
              {editorError ? <p className="text-sm text-[var(--accent-danger)]">{editorError}</p> : null}
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (editorState) {
                    const confirmed = window.confirm('Удалить заметку? Это действие нельзя отменить.');
                    if (confirmed) {
                      deleteMutation.mutate(editorState.id);
                    }
                  }
                }}
                className="text-[var(--accent-danger)] hover:text-[var(--accent-danger)]"
              >
                Удалить
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>
                  Отмена
                </Button>
                <Button type="button" onClick={handleEditorSave} disabled={updateMutation.isPending}>
                  Сохранить
                </Button>
              </div>
            </footer>
          </div>
        ) : null}
      </Modal>
    </PageLayout>
  );
}
