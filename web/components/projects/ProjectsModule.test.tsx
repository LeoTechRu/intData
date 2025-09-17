import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ProjectsModule from './ProjectsModule';

expect.extend(matchers);

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/projects',
}));

const API_BASE = 'http://localhost';
const originalFetch = global.fetch;

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
  pushMock.mockClear();
  replaceMock.mockClear();
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_API_BASE;
});

describe('ProjectsModule (Next UI)', () => {
  it('renders project catalog with quick metrics and navigation links', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
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
            { id: 10, name: 'Alpha', area_id: 2, description: 'Run club relaunch', slug: 'alpha' },
          ]),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderWithClient(<ProjectsModule />);

    await screen.findByText('Alpha');

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/v1/areas`, expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/v1/projects`, expect.anything());

    const areaCaptions = await screen.findAllByText('Фитнес');
    expect(areaCaptions.length).toBeGreaterThan(0);

    const quickButton = await screen.findByTestId('projects-quick-create-button');
    expect(quickButton).toBeInTheDocument();

    const totalCard = screen.getByText('Всего проектов').closest('section');
    expect(totalCard).not.toBeNull();
    if (totalCard) {
      expect(within(totalCard).getByText('1')).toBeInTheDocument();
    }

    const openLink = screen.getByRole('link', { name: /Перейти к проекту/ });
    expect(openLink).toHaveAttribute('href', '/projects/alpha');
  });

  it('creates project via quick action and triggers refetch', async () => {
    let projectsCall = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
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
            { id: 42, name: 'Новый проект', area_id: 1, description: null, slug: 'new-project' },
          ]),
        );
      }
      if (url.endsWith('/api/v1/projects') && init?.method === 'POST') {
        const body = init.body ? JSON.parse(init.body.toString()) : {};
        expect(body).toMatchObject({ name: 'Новый проект', area_id: 1 });
        return Promise.resolve(
          jsonResponse({ id: 42, name: 'Новый проект', area_id: 1, description: null, slug: 'new-project' }, { status: 201 }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderWithClient(<ProjectsModule />);

    const quickInput = await screen.findByLabelText('Название проекта');
    fireEvent.change(quickInput, { target: { value: 'Новый проект' } });

    const quickButton = await screen.findByTestId('projects-quick-create-button');
    fireEvent.click(quickButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/projects`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    expect(await screen.findByText('Новый проект')).toBeInTheDocument();
    await waitFor(() => expect(projectsCall).toBeGreaterThan(1));
    expect((quickInput as HTMLInputElement).value).toBe('');
  });

  it('filters projects by missing slug', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/areas')) {
        return Promise.resolve(
          jsonResponse([
            { id: 1, name: 'Inbox', depth: 0, review_interval_days: 7, parent_id: null, slug: 'inbox', mp_path: 'inbox.' },
          ]),
        );
      }
      if (url.endsWith('/api/v1/projects')) {
        return Promise.resolve(
          jsonResponse([
            { id: 10, name: 'Alpha', area_id: 1, description: null, slug: 'alpha' },
            { id: 11, name: 'Beta без слага', area_id: 1, description: null, slug: null },
          ]),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderWithClient(<ProjectsModule />);

    await screen.findByText('Alpha');
    expect(screen.getByText('Beta без слага')).toBeInTheDocument();

    const toggle = await screen.findByTestId('projects-filter-without-slug');
    fireEvent.click(toggle);

    await waitFor(() => {
      const cards = screen.getAllByTestId('projects-card');
      expect(cards).toHaveLength(1);
      expect(within(cards[0]).getByText('Beta без слага')).toBeInTheDocument();
    });
  });
});
