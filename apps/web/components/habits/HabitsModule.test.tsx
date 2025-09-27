import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HabitsModule from './HabitsModule';

expect.extend(matchers);

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => '/',
}));

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
  pushMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_API_BASE;
});

describe('HabitsModule', () => {
  it('renders habits and toggles completion', async () => {
    const today = new Date().toISOString().slice(0, 10);
    let dashboardCall = 0;
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
      if (url.includes('/api/v1/habits/dashboard') && (!init || init.method === undefined)) {
        dashboardCall += 1;
        if (dashboardCall === 1) {
          return Promise.resolve(
            jsonResponse({
              habits: [
                {
                  id: 5,
                  title: 'Утренняя зарядка',
                  frequency: 'daily',
                  area_id: 1,
                  project_id: null,
                  progress: [],
                },
              ],
              dailies: [],
              rewards: [],
              stats: { level: 2, xp: 40, gold: 15, hp: 48, kp: 120, daily_xp: 10, daily_gold: 5 },
            }),
          );
        }
        return Promise.resolve(
          jsonResponse({
            habits: [
              {
                id: 5,
                title: 'Утренняя зарядка',
                frequency: 'daily',
                area_id: 1,
                project_id: null,
                progress: [today],
              },
            ],
            dailies: [],
            rewards: [],
            stats: { level: 2, xp: 40, gold: 15, hp: 48, kp: 120, daily_xp: 10, daily_gold: 5 },
          }),
        );
      }
      if (url.endsWith('/api/v1/habits/5/toggle') && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 5, progress: [today] }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<HabitsModule />);

    expect(await screen.findByText('Утренняя зарядка')).toBeInTheDocument();
    const toggleButton = screen.getByRole('button', { name: 'Отметить' });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/habits/5/toggle`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Сбросить' })).toBeInTheDocument();
    });
  });

  it('creates a habit with selected area', async () => {
    let dashboardCall = 0;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/areas')) {
        return Promise.resolve(
          jsonResponse([
            { id: 1, name: 'Inbox', depth: 0, review_interval_days: 7, parent_id: null, slug: 'inbox', mp_path: 'inbox.' },
            { id: 2, name: 'Health', depth: 0, review_interval_days: 7, parent_id: null, slug: 'health', mp_path: 'health.' },
          ]),
        );
      }
      if (url.endsWith('/api/v1/projects')) {
        return Promise.resolve(jsonResponse([{ id: 10, name: 'Фитнес', area_id: 2, description: null, slug: 'fitness' }]));
      }
      if (url.includes('/api/v1/habits/dashboard') && (!init || init.method === undefined)) {
        dashboardCall += 1;
        if (dashboardCall === 1) {
          return Promise.resolve(
            jsonResponse({ habits: [], dailies: [], rewards: [], stats: { level: 1, xp: 0, gold: 0, hp: 50, kp: 0, daily_xp: 0, daily_gold: 0 } }),
          );
        }
        return Promise.resolve(
          jsonResponse({
            habits: [
              {
                id: 11,
                title: 'Пить воду',
                frequency: 'daily',
                area_id: 2,
                project_id: 10,
                progress: [],
              },
            ],
            dailies: [],
            rewards: [],
            stats: { level: 1, xp: 0, gold: 0, hp: 50, kp: 0, daily_xp: 0, daily_gold: 0 },
          }),
        );
      }
      if (url.endsWith('/api/v1/habits') && init?.method === 'POST') {
        const body = init.body ? JSON.parse(init.body.toString()) : {};
        expect(body).toMatchObject({ name: 'Пить воду', area_id: 2, frequency: 'daily' });
        return Promise.resolve(jsonResponse({ id: 11 }, { status: 201 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<HabitsModule />);

    const nameInput = await screen.findByPlaceholderText('Например, Утренняя зарядка');
    fireEvent.change(nameInput, { target: { value: 'Пить воду' } });

    const areaSelect = screen.getByLabelText('Область привычки');
    fireEvent.change(areaSelect, { target: { value: '2' } });

    const submitButton = screen.getByRole('button', { name: 'Создать' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/habits`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    expect(await screen.findByText('Пить воду')).toBeInTheDocument();
  });

  it('shows telegram CTA when backend requires linking', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/areas')) {
        return Promise.resolve(jsonResponse([]));
      }
      if (url.endsWith('/api/v1/projects')) {
        return Promise.resolve(jsonResponse([]));
      }
      if (url.includes('/api/v1/habits/dashboard') && (!init || init.method === undefined)) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'tg_link_required' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderWithClient(<HabitsModule />);

    const telegramCtas = await screen.findAllByText('Свяжите Telegram');
    expect(telegramCtas.length).toBeGreaterThan(0);

    const openSettingsButtons = screen.getAllByRole('button', { name: 'Открыть настройки' });
    fireEvent.click(openSettingsButtons[0]);

    expect(pushMock).toHaveBeenCalledWith('/settings#telegram-linking');
    expect(fetchMock).toHaveBeenCalled();
  });
});
