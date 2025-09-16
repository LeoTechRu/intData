import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AreasModule from './AreasModule';

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

describe('AreasModule', () => {
  it('renders areas tree and allows selection', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/areas')) {
        return Promise.resolve(
          jsonResponse([
            { id: 1, name: 'Inbox', depth: 0, review_interval_days: 7, parent_id: null, slug: 'inbox', mp_path: 'inbox.' },
            { id: 2, name: 'Product', depth: 1, review_interval_days: 7, parent_id: 1, slug: 'product', mp_path: 'inbox.product.' },
          ]),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<AreasModule />);

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/v1/areas`, expect.anything());
    expect(await screen.findByTestId('area-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('area-node-2')).toBeInTheDocument();

    // detail for first area visible by default
    expect(await screen.findByText(/ID #1/)).toBeInTheDocument();

    // select second area
    const productButton = screen.getByTestId('area-node-2');
    fireEvent.click(productButton);
    await waitFor(() => {
      expect(screen.getByText(/ID #2/)).toBeInTheDocument();
    });
  });

  it('creates a new area and refetches list', async () => {
    let areasCall = 0;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/areas') && (!init || init.method === undefined)) {
        areasCall += 1;
        if (areasCall === 1) {
          return Promise.resolve(
            jsonResponse([
              { id: 1, name: 'Inbox', depth: 0, review_interval_days: 7, parent_id: null, slug: 'inbox', mp_path: 'inbox.' },
              { id: 2, name: 'Product', depth: 1, review_interval_days: 7, parent_id: 1, slug: 'product', mp_path: 'inbox.product.' },
            ]),
          );
        }
        return Promise.resolve(
          jsonResponse([
            { id: 1, name: 'Inbox', depth: 0, review_interval_days: 7, parent_id: null, slug: 'inbox', mp_path: 'inbox.' },
            { id: 2, name: 'Product', depth: 1, review_interval_days: 7, parent_id: 1, slug: 'product', mp_path: 'inbox.product.' },
            { id: 3, name: 'Маркетинг', depth: 2, review_interval_days: 7, parent_id: 2, slug: 'marketing', mp_path: 'inbox.product.marketing.' },
          ]),
        );
      }
      if (url.endsWith('/api/v1/areas') && init?.method === 'POST') {
        const payload = init.body ? JSON.parse(init.body.toString()) : {};
        expect(payload).toMatchObject({ name: 'Маркетинг', parent_id: 2 });
        return Promise.resolve(
          jsonResponse(
            { id: 3, name: 'Маркетинг', depth: 2, review_interval_days: 7, parent_id: 2, slug: 'marketing', mp_path: 'inbox.product.marketing.' },
            { status: 201 },
          ),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<AreasModule />);

    const nameInput = await screen.findByLabelText('Название новой области');
    fireEvent.change(nameInput, { target: { value: 'Маркетинг' } });
    const parentSelect = screen.getByLabelText('Родительская область');
    fireEvent.change(parentSelect, { target: { value: '2' } });

    const createForm = nameInput.closest('form');
    fireEvent.submit(createForm!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/areas`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    expect(await screen.findByTestId('area-node-3')).toBeInTheDocument();
  });

  it('renames area and shows success message', async () => {
    let areasCall = 0;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/areas') && (!init || init.method === undefined)) {
        areasCall += 1;
        return Promise.resolve(
          jsonResponse([
            { id: 1, name: 'Inbox', depth: 0, review_interval_days: 7, parent_id: null, slug: 'inbox', mp_path: 'inbox.' },
            { id: 2, name: 'Product', depth: 1, review_interval_days: 7, parent_id: 1, slug: 'product', mp_path: 'inbox.product.' },
          ]),
        );
      }
      if (url.endsWith('/api/v1/areas/2/rename') && init?.method === 'POST') {
        const payload = init.body ? JSON.parse(init.body.toString()) : {};
        expect(payload).toMatchObject({ name: 'Продукты' });
        return Promise.resolve(jsonResponse({ id: 2, name: 'Продукты' }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<AreasModule />);

    const productButton = await screen.findByTestId('area-node-2');
    fireEvent.click(productButton);

    const renameInput = await screen.findByLabelText('Новое название');
    fireEvent.change(renameInput, { target: { value: 'Продукты' } });
    fireEvent.submit(renameInput.closest('form')!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/areas/2/rename`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    expect(await screen.findByText('Название обновлено')).toBeInTheDocument();
  });
});
