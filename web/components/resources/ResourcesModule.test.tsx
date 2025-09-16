import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResourcesModule from './ResourcesModule';

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

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE = API_BASE;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_API_BASE;
});

describe('ResourcesModule', () => {
  it('renders resources list', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/resources')) {
        return Promise.resolve(
          jsonResponse([
            { id: 1, title: 'Бриф проекта', type: 'Документ' },
            { id: 2, title: 'Miro доска', type: 'Ссылка' },
          ]),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<ResourcesModule />);

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/v1/resources`, expect.anything());
    expect(await screen.findByText('Бриф проекта')).toBeInTheDocument();
    expect(screen.getByText('Miro доска')).toBeInTheDocument();
  });

  it('creates new resource and refetches list', async () => {
    let resourcesCall = 0;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/resources') && (!init || init.method === undefined)) {
        resourcesCall += 1;
        if (resourcesCall === 1) {
          return Promise.resolve(jsonResponse([]));
        }
        return Promise.resolve(
          jsonResponse([
            { id: 3, title: 'Onboarding PDF', type: 'Документ' },
          ]),
        );
      }
      if (url.endsWith('/api/v1/resources') && init?.method === 'POST') {
        const payload = init.body ? JSON.parse(init.body.toString()) : {};
        expect(payload).toMatchObject({ title: 'Onboarding PDF', type: 'Документ', content: null });
        return Promise.resolve(jsonResponse({ id: 3, title: 'Onboarding PDF', type: 'Документ' }, { status: 201 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<ResourcesModule />);

    const titleInput = await screen.findByLabelText('Заголовок');
    fireEvent.change(titleInput, { target: { value: 'Onboarding PDF' } });
    const typeInput = screen.getByLabelText('Тип (опционально)');
    fireEvent.change(typeInput, { target: { value: 'Документ' } });

    const form = titleInput.closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/resources`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    expect(await screen.findByText('Onboarding PDF')).toBeInTheDocument();
  });
});
