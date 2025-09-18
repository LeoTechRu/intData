import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsModule from './SettingsModule';

expect.extend(matchers);

const API_BASE = 'http://backend';

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE = API_BASE;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_API_BASE;
});

describe('SettingsModule', () => {
  it('renders personalization and areas sections', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/v1/user/settings?keys=')) {
        return Promise.resolve(
          jsonResponse({
            dashboard_layout: { v: 1, widgets: ['profile_card', 'today'] },
            favorites: { v: 1, items: [{ path: '/', label: 'Обзор', position: 1 }] },
            favorite_options: [
              { path: '/', label: 'Обзор' },
              { path: '/inbox', label: 'Входящие' },
            ],
            theme_preferences: { mode: 'system', primary: '#64C6A9' },
          }),
        );
      }
      if (url.endsWith('/api/v1/areas')) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 1,
              name: 'Inbox',
              depth: 0,
              review_interval_days: 7,
              parent_id: null,
              slug: 'inbox',
              mp_path: 'inbox.',
            },
          ]),
        );
      }
      if (url.endsWith('/api/v1/app-settings?prefix=theme.global.')) {
        return Promise.resolve(jsonResponse({ entries: {} }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<SettingsModule />);

    expect(await screen.findByText('Региональные настройки')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Посмотреть обновления тарифов' })).toBeInTheDocument();
    expect(await screen.findByText('Тема интерфейса')).toBeInTheDocument();
    expect(await screen.findByText('Области жизни (PARA)')).toBeInTheDocument();
    expect(await screen.findByTestId('area-node-1')).toBeInTheDocument();

    fetchMock.mockRestore();
  });
});
