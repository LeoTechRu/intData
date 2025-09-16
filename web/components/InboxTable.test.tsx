import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InboxTable from './InboxTable';

expect.extend(matchers);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete process.env.API_URL;
  delete process.env.NEXT_PUBLIC_API_BASE;
});

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('InboxTable', () => {
  it('renders fetched notes', async () => {
    const apiBase = 'http://backend';
    process.env.NEXT_PUBLIC_API_BASE = apiBase;
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, title: 'Test', content: 'Note' }],
    } as any);

    renderWithClient(<InboxTable />);
    expect(fetchMock).toHaveBeenCalledWith(
      `${apiBase}/api/v1/inbox/notes`,
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(await screen.findByText('Test')).toBeInTheDocument();
    expect(await screen.findByText('Note')).toBeInTheDocument();
  });

  it('shows empty placeholder', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as any);

    renderWithClient(<InboxTable />);
    const emptyState = await screen.findByTestId('empty');
    expect(emptyState).toHaveTextContent('Здесь пока пусто');
  });

  it('filters notes by search query', async () => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://backend';
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 1, title: 'Первый', content: 'Alpha' },
        { id: 2, title: 'Второй', content: 'Bravo' },
      ],
    } as any);

    renderWithClient(<InboxTable />);

    expect(await screen.findByText('Первый')).toBeInTheDocument();
    const [searchInput] = screen.getAllByPlaceholderText('Поиск заметок');
    fireEvent.change(searchInput, { target: { value: 'Bravo' } });

    expect(await screen.findByText('Bravo')).toBeInTheDocument();
    expect(screen.queryByText('Первый')).not.toBeInTheDocument();
  });

  it('renders error state when fetch fails', async () => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://backend';
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as any);

    renderWithClient(<InboxTable />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Не удалось загрузить данные');
    expect(alert).toHaveTextContent('Не удалось загрузить входящие');
  });
});
