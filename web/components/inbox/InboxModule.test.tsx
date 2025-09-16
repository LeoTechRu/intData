import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import InboxModule from './InboxModule';

expect.extend(matchers);

function createJsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (header: string) => (header.toLowerCase() === 'content-type' ? 'application/json' : null),
    } as Headers,
    json: async () => data,
  } as unknown as Response;
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const API_BASE = 'http://backend';

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE = API_BASE;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_API_BASE;
});

describe('InboxModule', () => {
  it('renders hero and aggregated stats', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url === `${API_BASE}/api/v1/areas`) {
        return Promise.resolve(
          createJsonResponse([
            { id: 1, name: 'Входящие', slug: 'inbox', depth: 0, review_interval_days: 7, parent_id: null, mp_path: '1.' },
            { id: 2, name: 'Проекты', slug: 'projects', depth: 1, review_interval_days: 7, parent_id: 1, mp_path: '1.2.' },
          ]),
        );
      }
      if (url === `${API_BASE}/api/v1/inbox/notes`) {
        return Promise.resolve(createJsonResponse([
          { id: 1, title: 'Конспект', content: 'Нужно раскидать заметки' },
          { id: 2, title: 'Идея', content: 'Добавить новый проект' },
        ]));
      }
      if (url.startsWith(`${API_BASE}/api/v1/tasks`)) {
        return Promise.resolve(
          createJsonResponse([
            {
              id: 10,
              title: 'Уточнить дедлайны',
              description: null,
              status: 'todo',
              due_date: null,
              tracked_minutes: 0,
              running_entry_id: null,
              control_enabled: false,
              control_status: null,
              control_next_at: null,
              control_frequency: null,
              remind_policy: {},
              is_watched: false,
            },
          ]),
        );
      }
      if (url.startsWith(`${API_BASE}/api/v1/projects`)) {
        return Promise.resolve(createJsonResponse([
          { id: 51, name: 'Новый лендинг', area_id: 1, description: null, slug: null },
        ]));
      }
      if (url === `${API_BASE}/api/v1/resources`) {
        return Promise.resolve(createJsonResponse([]));
      }
      if (url.startsWith(`${API_BASE}/api/v1/calendar/agenda`)) {
        return Promise.resolve(
          createJsonResponse([
            {
              id: 91,
              title: 'Командная встреча',
              start_at: '2025-09-15T09:00:00Z',
              end_at: null,
              tzid: 'UTC',
              description: null,
              project_id: null,
              area_id: 1,
            },
          ]),
        );
      }
      throw new Error(`Unhandled fetch to ${url}`);
    });

    renderWithClient(<InboxModule />);

    expect(await screen.findByText('Центральное место для всех неразобранных идей, задач и событий')).toBeInTheDocument();

    const notesHint = await screen.findByText('Быстрые захваты из бота и веб-форм');
    expect(notesHint.closest('article')).toHaveTextContent('2');

    const tasksHint = screen.getByText('Требуют распределения или уточнения');
    expect(tasksHint.closest('article')).toHaveTextContent('1');

    expect(fetchMock).toHaveBeenCalled();
  });

  it('shows focus preview before session starts', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url === `${API_BASE}/api/v1/areas`) {
        return Promise.resolve(
          createJsonResponse([
            { id: 1, name: 'Входящие', slug: 'inbox', depth: 0, review_interval_days: 7, parent_id: null, mp_path: '1.' },
            { id: 2, name: 'Маркетинг', slug: 'marketing', depth: 1, review_interval_days: 7, parent_id: 1, mp_path: '1.2.' },
          ]),
        );
      }
      if (url === `${API_BASE}/api/v1/inbox/notes`) {
        return Promise.resolve(createJsonResponse([{ id: 5, title: 'Прочитать статью', content: 'Сохранить ссылку и разложить' }]));
      }
      if (url.startsWith(`${API_BASE}/api/v1/tasks`)) {
        return Promise.resolve(createJsonResponse([]));
      }
      if (url.startsWith(`${API_BASE}/api/v1/projects`)) {
        return Promise.resolve(createJsonResponse([]));
      }
      if (url === `${API_BASE}/api/v1/resources`) {
        return Promise.resolve(createJsonResponse([]));
      }
      if (url.startsWith(`${API_BASE}/api/v1/calendar/agenda`)) {
        return Promise.resolve(createJsonResponse([]));
      }
      throw new Error(`Unhandled fetch to ${url}`);
    });

    renderWithClient(<InboxModule />);

    expect(await screen.findByText('Готовы разобраться?')).toBeInTheDocument();
    expect(screen.getByText('Прочитать статью')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Начать разбор' })).toBeInTheDocument();
  });

  it('assigns note to area from focus session', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url === `${API_BASE}/api/v1/areas`) {
        return Promise.resolve(
          createJsonResponse([
            { id: 1, name: 'Входящие', slug: 'inbox', depth: 0, review_interval_days: 7, parent_id: null, mp_path: '1.' },
            { id: 2, name: 'Маркетинг', slug: 'marketing', depth: 1, review_interval_days: 7, parent_id: 1, mp_path: '1.2.' },
          ]),
        );
      }
      if (url === `${API_BASE}/api/v1/inbox/notes`) {
        return Promise.resolve(createJsonResponse([{ id: 7, title: 'Новая идея', content: 'Подумать над экспериментом' }]));
      }
      if (url.startsWith(`${API_BASE}/api/v1/tasks`)) {
        return Promise.resolve(createJsonResponse([]));
      }
      if (url.startsWith(`${API_BASE}/api/v1/projects`)) {
        return Promise.resolve(createJsonResponse([{ id: 11, name: 'Кампания', area_id: 1, description: null, slug: null }]));
      }
      if (url === `${API_BASE}/api/v1/resources`) {
        return Promise.resolve(createJsonResponse([]));
      }
      if (url.startsWith(`${API_BASE}/api/v1/calendar/agenda`)) {
        return Promise.resolve(createJsonResponse([]));
      }
      if (url === `${API_BASE}/api/v1/notes/7/assign` && init?.method === 'POST') {
        return Promise.resolve(createJsonResponse({
          id: 7,
          title: 'Новая идея',
          content: 'Подумать над экспериментом',
        }));
      }
      throw new Error(`Unhandled fetch to ${url}`);
    });

    renderWithClient(<InboxModule />);

    await screen.findByText('Готовы разобраться?');

    fireEvent.click(screen.getByRole('button', { name: 'Начать разбор' }));

    await screen.findByRole('heading', { name: 'Новая идея' });

    const areaSelect = screen.getByRole('combobox', { name: 'Выберите область' });
    fireEvent.change(areaSelect, { target: { value: '2' } });

    const saveButton = screen.getByRole('button', { name: 'Сохранить и дальше' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const assignCall = fetchMock.mock.calls.find(([request]) => {
        const url = typeof request === 'string' ? request : request.url;
        return url === `${API_BASE}/api/v1/notes/7/assign`;
      });
      expect(assignCall).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Новая идея' })).not.toBeInTheDocument();
    });
  });
});
