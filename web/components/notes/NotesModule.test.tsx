import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import NotesModule from './NotesModule';

expect.extend(matchers);

const API_BASE = 'http://localhost';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const areasPayload = [
  {
    id: 1,
    name: 'Входящие',
    color: '#FFF8B8',
    review_interval_days: 7,
    parent_id: null,
    depth: 0,
    slug: 'inbox',
    mp_path: 'inbox.',
  },
  {
    id: 2,
    name: 'Продукт',
    color: '#C7D2FE',
    review_interval_days: 7,
    parent_id: 1,
    depth: 1,
    slug: 'product',
    mp_path: 'inbox.product.',
  },
];

const projectsPayload = [
  {
    id: 11,
    name: 'Pulse',
    area_id: 2,
    description: null,
    slug: 'pulse',
  },
];

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE = API_BASE;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_API_BASE;
});

describe('NotesModule', () => {
  it('renders notes feed and toggles pin state', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/areas')) {
        return Promise.resolve(jsonResponse(areasPayload));
      }
      if (url.endsWith('/api/v1/projects')) {
        return Promise.resolve(jsonResponse(projectsPayload));
      }
      if (url.endsWith('/api/v1/notes') && (!init || init.method === undefined)) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 101,
              title: 'Планы на релиз',
              content: 'Согласовать фичи и дедлайны.',
              pinned: false,
              archived_at: null,
              order_index: 10,
              area_id: 2,
              project_id: 11,
              color: '#C7D2FE',
              area: { id: 2, name: 'Продукт', slug: 'product', color: '#C7D2FE' },
              project: { id: 11, name: 'Pulse' },
            },
          ]),
        );
      }
      if (url.endsWith('/api/v1/notes/101') && init?.method === 'PATCH') {
        return Promise.resolve(
          jsonResponse({
            id: 101,
            title: 'Планы на релиз',
            content: 'Согласовать фичи и дедлайны.',
            pinned: true,
            archived_at: null,
            order_index: 10,
            area_id: 2,
            project_id: 11,
            color: '#C7D2FE',
            area: { id: 2, name: 'Продукт', slug: 'product', color: '#C7D2FE' },
            project: { id: 11, name: 'Pulse' },
          }),
        );
      }
      if (url.endsWith('/api/v1/notes/101/archive') && init?.method === 'POST') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.endsWith('/api/v1/notes/101/unarchive') && init?.method === 'POST') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.endsWith('/api/v1/notes/reorder') && init?.method === 'POST') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<NotesModule />);

    expect(await screen.findByText('Планы на релиз')).toBeInTheDocument();

    const pinButton = screen.getByRole('button', { name: 'Закрепить заметку' });
    fireEvent.click(pinButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/notes/101`,
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('creates a new note from quick form', async () => {
    let notesRequestCount = 0;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/areas')) {
        return Promise.resolve(jsonResponse(areasPayload));
      }
      if (url.endsWith('/api/v1/projects')) {
        return Promise.resolve(jsonResponse(projectsPayload));
      }
      if (url.endsWith('/api/v1/notes') && (!init || init.method === undefined)) {
        notesRequestCount += 1;
        if (notesRequestCount === 1) {
          return Promise.resolve(jsonResponse([]));
        }
        return Promise.resolve(
          jsonResponse([
            {
              id: 202,
              title: 'Экосистемные идеи',
              content: 'Проверить интеграции и оффер.',
              pinned: false,
              archived_at: null,
              order_index: 20,
              area_id: 1,
              project_id: null,
              color: '#FFF8B8',
              area: { id: 1, name: 'Входящие', slug: 'inbox', color: '#FFF8B8' },
              project: null,
            },
          ]),
        );
      }
      if (url.endsWith('/api/v1/notes') && init?.method === 'POST') {
        const body = init.body ? JSON.parse(init.body.toString()) : {};
        expect(body).toMatchObject({
          content: 'Проверить интеграции и оффер.',
          area_id: 1,
          pinned: false,
        });
        return Promise.resolve(
          jsonResponse({
            id: 202,
            title: body.title ?? null,
            content: body.content,
            pinned: false,
            archived_at: null,
            order_index: 20,
            area_id: 1,
            project_id: null,
            color: '#FFF8B8',
            area: { id: 1, name: 'Входящие', slug: 'inbox', color: '#FFF8B8' },
            project: null,
          }),
        );
      }
      if (url.includes('/api/v1/notes/') && url.endsWith('/archive') && init?.method === 'POST') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes('/api/v1/notes/') && url.endsWith('/unarchive') && init?.method === 'POST') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.endsWith('/api/v1/notes/reorder')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<NotesModule />);

    const textarea = await screen.findByPlaceholderText('Фиксируйте мысли, ссылки и рабочие детали.');
    fireEvent.change(textarea, { target: { value: 'Проверить интеграции и оффер.' } });

    const saveButton = screen.getByRole('button', { name: 'Сохранить заметку' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/notes`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => expect(notesRequestCount).toBeGreaterThan(1));
    expect(await screen.findByText('Экосистемные идеи')).toBeInTheDocument();
  });

  it('archives and restores note through list actions', async () => {
    let notesRequestCount = 0;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/areas')) {
        return Promise.resolve(jsonResponse(areasPayload));
      }
      if (url.endsWith('/api/v1/projects')) {
        return Promise.resolve(jsonResponse(projectsPayload));
      }
      if (url.includes('/api/v1/profiles')) {
        return Promise.resolve(jsonResponse({}));
      }
      if (url.includes('/api/v1/navigation/sidebar')) {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      if (url.includes('/api/v1/notes') && (!init || init.method === undefined)) {
        notesRequestCount += 1;
        if (notesRequestCount === 1) {
          return Promise.resolve(
            jsonResponse([
              {
                id: 101,
                title: 'Планы на релиз',
                content: 'Согласовать фичи и дедлайны.',
                pinned: false,
                archived_at: null,
                order_index: 10,
                area_id: 2,
                project_id: 11,
                color: '#C7D2FE',
                area: { id: 2, name: 'Продукт', slug: 'product', color: '#C7D2FE' },
                project: { id: 11, name: 'Pulse' },
              },
            ]),
          );
        }
        if (notesRequestCount === 2) {
          return Promise.resolve(jsonResponse([]));
        }
        if (notesRequestCount === 3) {
          return Promise.resolve(
            jsonResponse([
              {
                id: 101,
                title: 'Планы на релиз',
                content: 'Согласовать фичи и дедлайны.',
                pinned: false,
                archived_at: '2025-09-18T10:00:00Z',
                order_index: 10,
                area_id: 2,
                project_id: 11,
                color: '#C7D2FE',
                area: { id: 2, name: 'Продукт', slug: 'product', color: '#C7D2FE' },
                project: { id: 11, name: 'Pulse' },
              },
            ]),
          );
        }
        return Promise.resolve(jsonResponse([]));
      }
      if (url.endsWith('/api/v1/notes/101/archive') && init?.method === 'POST') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.endsWith('/api/v1/notes/101/unarchive') && init?.method === 'POST') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithClient(<NotesModule />);

    expect(await screen.findByText('Планы на релиз')).toBeInTheDocument();

    const archiveButton = screen.getByRole('button', { name: 'Архивировать' });
    fireEvent.click(archiveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/notes/101/archive`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Нет заметок')).toBeInTheDocument();
    });

    const archiveToggle = screen.getByLabelText('Показать архив');
    fireEvent.click(archiveToggle);
    const applyFilters = screen.getByRole('button', { name: 'Применить фильтры' });
    fireEvent.click(applyFilters);

    await waitFor(() => {
      expect(screen.getByText('В архиве')).toBeInTheDocument();
    });

    const restoreButton = screen.getByRole('button', { name: 'Восстановить' });
    fireEvent.click(restoreButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/notes/101/unarchive`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
