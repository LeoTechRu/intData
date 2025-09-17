import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UsersCatalog from './UsersCatalog';

expect.extend(matchers);

const API_BASE = 'http://backend';

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

function textResponse(message: string, init: ResponseInit = {}) {
  return new Response(message, {
    status: 500,
    headers: { 'Content-Type': 'text/plain' },
    ...init,
  });
}

const viewerSummary = {
  user_id: 42,
  username: 'tester',
  role: 'single',
  profile_slug: 'tester',
  display_name: 'Test User',
  avatar_url: null,
  headline: 'QA Lead',
};

function isViewerUrl(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string' ? input : input.toString();
  return url.includes('/profiles/users/@me');
}

function isNavigationUrl(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string' ? input : input.toString();
  return url.includes('/navigation/sidebar');
}

const navResponse = {
  v: 1,
  items: [
    { key: 'overview', label: 'Обзор', href: '/', hidden: false, position: 1 },
  ],
  layout: {
    user: { v: 1, items: [{ key: 'overview', position: 1, hidden: false }] },
    global: null,
  },
  can_edit_global: false,
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE = API_BASE;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_API_BASE;
});

describe('UsersCatalog', () => {
  it('renders users', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      if (isViewerUrl(input)) {
        return Promise.resolve(jsonResponse(viewerSummary));
      }
      if (isNavigationUrl(input)) {
        return Promise.resolve(jsonResponse(navResponse));
      }
      return Promise.resolve(
        jsonResponse([
          { slug: 'alice', display_name: 'Alice', headline: 'Designer', summary: 'UX lead' },
          { slug: 'bob', display_name: 'Bob', headline: 'Engineer', summary: 'Backend dev' },
        ]),
      );
    });

    renderWithClient(<UsersCatalog />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/v1/profiles/users`, expect.anything()),
    );
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('submits search query', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      if (isViewerUrl(input)) {
        return Promise.resolve(jsonResponse(viewerSummary));
      }
      if (isNavigationUrl(input)) {
        return Promise.resolve(jsonResponse(navResponse));
      }
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('search=designer')) {
        return Promise.resolve(jsonResponse([{ slug: 'alice', display_name: 'Alice', headline: 'Designer' }]));
      }
      return Promise.resolve(jsonResponse([]));
    });

    renderWithClient(<UsersCatalog />);

    const input = screen.getByPlaceholderText('Поиск по имени или описанию');
    fireEvent.change(input, { target: { value: 'designer' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/profiles/users?search=designer`,
        expect.anything(),
      );
    });

    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  it('shows error state and retries fetch', async () => {
    let catalogCalls = 0;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      if (isViewerUrl(input)) {
        return Promise.resolve(jsonResponse(viewerSummary));
      }
      if (isNavigationUrl(input)) {
        return Promise.resolve(jsonResponse(navResponse));
      }
      const url = typeof input === 'string' ? input : input.toString();
      if (!url.includes('search')) {
        catalogCalls += 1;
        if (catalogCalls === 1) {
          return Promise.resolve(textResponse('Сервер недоступен', { status: 503 }));
        }
      }
      return Promise.resolve(jsonResponse([{ slug: 'carol', display_name: 'Carol', headline: 'PM' }]));
    });

    renderWithClient(<UsersCatalog />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Не удалось загрузить каталог');

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    expect(await screen.findByText('Carol')).toBeInTheDocument();
  });
});
