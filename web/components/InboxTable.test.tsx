import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InboxTable from './InboxTable';

expect.extend(matchers);

afterEach(() => {
  vi.restoreAllMocks();
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
      { credentials: 'include' },
    );
    expect(await screen.findByText('Test')).toBeInTheDocument();
  });

  it('shows empty placeholder', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as any);

    renderWithClient(<InboxTable />);
    expect(await screen.findByTestId('empty')).toBeInTheDocument();
  });
});
