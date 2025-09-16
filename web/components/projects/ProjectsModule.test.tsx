import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectsModule from './ProjectsModule';

expect.extend(matchers);

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const API_BASE = 'http://localhost';

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

describe('ProjectsModule', () => {
  it('renders projects list', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/areas')) {
        return Promise.resolve(
          jsonResponse([
            { id: 1, name: 'Inbox', depth: 0, review_interval_days: 7, parent_id: null, slug: 'inbox', mp_path: 'inbox.' },
            { id: 2, name: 'Фитнес', depth: 1, review_interval_days: 7, parent_id: 1, slug: 'fitness', mp_path: 'inbox.fitness.' },
          ]),
        );
      }
      if (url.endsWith('/api/v1/projects')) {
        return Promise.resolve(
          jsonResponse([
            { id: 10, name: 'Alpha', area_id: 2, description: null, slug: 'alpha' },
          ]),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<ProjectsModule />);

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/v1/areas`, expect.anything());
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Area #2')).not.toBeInTheDocument();
    expect(screen.getByText('Фитнес')).toBeInTheDocument();
  });

  it('creates new project and refetches list', async () => {
    let projectsCall = 0;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/areas')) {
        return Promise.resolve(
          jsonResponse([
            { id: 1, name: 'Inbox', depth: 0, review_interval_days: 7, parent_id: null, slug: 'inbox', mp_path: 'inbox.' },
            { id: 2, name: 'Фитнес', depth: 1, review_interval_days: 7, parent_id: 1, slug: 'fitness', mp_path: 'inbox.fitness.' },
          ]),
        );
      }
      if (url.endsWith('/api/v1/projects') && (!init || init.method === undefined || init.method === 'GET')) {
        projectsCall += 1;
        if (projectsCall === 1) {
          return Promise.resolve(jsonResponse([]));
        }
        return Promise.resolve(
          jsonResponse([
            { id: 42, name: 'Новый проект', area_id: 2, description: null, slug: 'new-project' },
          ]),
        );
      }
      if (url.endsWith('/api/v1/projects') && init?.method === 'POST') {
        const body = init.body ? JSON.parse(init.body.toString()) : {};
        expect(body).toMatchObject({ name: 'Новый проект', area_id: 2, slug: 'new-project' });
        return Promise.resolve(jsonResponse({ id: 42, name: 'Новый проект', area_id: 2, description: null, slug: 'new-project' }, { status: 201 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<ProjectsModule />);

    const nameInput = await screen.findByLabelText('Название проекта');
    fireEvent.change(nameInput, { target: { value: 'Новый проект' } });
    const areaSelect = screen.getByLabelText('Область (Area)');
    fireEvent.change(areaSelect, { target: { value: '2' } });
    const slugInput = screen.getByLabelText('Слаг (опционально)');
    fireEvent.change(slugInput, { target: { value: 'new-project' } });

    fireEvent.submit(nameInput.closest('form')!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/projects`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    expect(await screen.findByText('Новый проект')).toBeInTheDocument();
    await waitFor(() => {
      expect(projectsCall).toBeGreaterThan(1);
    });
  });
});
