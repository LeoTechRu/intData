import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TasksModule from './TasksModule';

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

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE = API_BASE;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_API_BASE;
});

describe('TasksModule', () => {
  it('renders tasks and triggers start timer', async () => {
    let tasksCall = 0;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/areas')) {
        return Promise.resolve(
          jsonResponse([
            { id: 1, name: 'Inbox', depth: 0, review_interval_days: 7, parent_id: null, slug: 'inbox', mp_path: 'inbox.' },
          ]),
        );
      }
      if (url.endsWith('/api/v1/projects')) {
        return Promise.resolve(jsonResponse([]));
      }
      if (url.endsWith('/api/v1/tasks') && (!init || init.method === undefined)) {
        tasksCall += 1;
        if (tasksCall === 1) {
          return Promise.resolve(
            jsonResponse([
              {
                id: 5,
                title: 'Подготовить отчёт',
                description: 'Собрать метрики за неделю',
                status: 'todo',
                due_date: '2025-09-16T10:00:00Z',
                tracked_minutes: 0,
                running_entry_id: null,
              },
            ]),
          );
        }
        return Promise.resolve(
          jsonResponse([
            {
              id: 5,
              title: 'Подготовить отчёт',
              description: 'Собрать метрики за неделю',
              status: 'todo',
              due_date: '2025-09-16T10:00:00Z',
              tracked_minutes: 5,
              running_entry_id: 99,
            },
          ]),
        );
      }
      if (url.endsWith('/api/v1/tasks/5/start_timer') && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            id: 5,
            title: 'Подготовить отчёт',
            description: 'Собрать метрики за неделю',
            status: 'todo',
            due_date: '2025-09-16T10:00:00Z',
            tracked_minutes: 0,
            running_entry_id: 99,
          }),
        );
      }
      if (url.endsWith('/api/v1/tasks/5/stop_timer') && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({
          id: 5,
          title: 'Подготовить отчёт',
          description: 'Собрать метрики за неделю',
          status: 'todo',
          due_date: '2025-09-16T10:00:00Z',
          tracked_minutes: 40,
          running_entry_id: null,
        }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<TasksModule />);

    expect(await screen.findByText('Подготовить отчёт')).toBeInTheDocument();
    const startButton = screen.getByRole('button', { name: 'Старт' });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/tasks/5/start_timer`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => expect(tasksCall).toBeGreaterThan(1));
    expect(await screen.findByRole('button', { name: 'Стоп' })).toBeInTheDocument();
  });

  it('creates new task with selected area', async () => {
    let tasksCall = 0;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/areas')) {
        return Promise.resolve(
          jsonResponse([
            { id: 1, name: 'Inbox', depth: 0, review_interval_days: 7, parent_id: null, slug: 'inbox', mp_path: 'inbox.' },
            { id: 2, name: 'Product', depth: 1, review_interval_days: 7, parent_id: 1, slug: 'product', mp_path: 'inbox.product.' },
          ]),
        );
      }
      if (url.endsWith('/api/v1/projects')) {
        return Promise.resolve(jsonResponse([{ id: 10, name: 'Pulse', area_id: 2, description: null, slug: 'pulse' }]));
      }
      if (url.endsWith('/api/v1/tasks') && (!init || init.method === undefined)) {
        tasksCall += 1;
        if (tasksCall === 1) {
          return Promise.resolve(jsonResponse([]));
        }
        return Promise.resolve(
          jsonResponse([
            {
              id: 11,
              title: 'Релизный чек-лист',
              description: 'Проверить backup и мониторинг',
              status: 'todo',
              due_date: null,
              tracked_minutes: 0,
              running_entry_id: null,
            },
          ]),
        );
      }
      if (url.endsWith('/api/v1/tasks') && init?.method === 'POST') {
        const body = init.body ? JSON.parse(init.body.toString()) : {};
        expect(body).toMatchObject({ title: 'Релизный чек-лист', area_id: 2, project_id: 10 });
        return Promise.resolve(
          jsonResponse(
            {
              id: 11,
              title: 'Релизный чек-лист',
              description: 'Проверить backup и мониторинг',
              status: 'todo',
              due_date: null,
              tracked_minutes: 0,
              running_entry_id: null,
            },
            { status: 201 },
          ),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<TasksModule />);

    const titleInput = await screen.findByLabelText('Название');
    fireEvent.change(titleInput, { target: { value: 'Релизный чек-лист' } });

    const areaSelect = screen.getAllByLabelText('Область')[1];
    fireEvent.change(areaSelect, { target: { value: '2' } });

    const projectSelect = screen.getByLabelText('Проект (опционально)');
    fireEvent.change(projectSelect, { target: { value: '10' } });

    const description = screen.getByLabelText('Описание (опционально)');
    fireEvent.change(description, { target: { value: 'Проверить backup и мониторинг' } });

    const form = titleInput.closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/tasks`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => expect(tasksCall).toBeGreaterThan(1));
    expect(await screen.findByText('Релизный чек-лист')).toBeInTheDocument();
  });
});
