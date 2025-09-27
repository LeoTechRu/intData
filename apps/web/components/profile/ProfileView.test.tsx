import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfileView from './ProfileView';

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

describe('ProfileView', () => {
  it('renders profile data', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/profiles/users/@me')) {
        return Promise.resolve(
          jsonResponse({
            user_id: 7,
            username: 'tester',
            role: 'single',
            profile_slug: 'tester',
            display_name: 'Test User',
            avatar_url: null,
            headline: 'QA Lead',
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({
          slug: 'alpha',
          display_name: 'Project Alpha',
          headline: 'Основной проект',
          summary: 'Запуск нового лендинга',
          avatar_url: 'https://example.com/avatar.png',
          cover_url: 'https://example.com/cover.jpg',
          profile_meta: { owner: 'Иван', status: 'Active' },
          tags: ['marketing', 'launch'],
          sections: [
            { id: 'overview', title: 'Обзор' },
            { id: 'docs' },
          ],
        }),
      );
    });

    renderWithClient(
      <ProfileView entity="projects" slug="alpha" backHref="/projects" backLabel="← Назад" />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const main = await screen.findByRole('main');
    expect(within(main).getAllByText('Project Alpha').length).toBeGreaterThan(0);
    expect(within(main).getAllByText('Основной проект').length).toBeGreaterThan(0);
    expect(within(main).getByText('Запуск нового лендинга')).toBeInTheDocument();
    expect(within(main).getByText('owner')).toBeInTheDocument();
    expect(within(main).getByText('Иван')).toBeInTheDocument();
    expect(within(main).getByText('marketing')).toBeInTheDocument();
    expect(within(main).getByText('Обзор')).toBeInTheDocument();
    expect(within(main).getByText('docs')).toBeInTheDocument();
    expect(screen.getByText('← Назад')).toHaveAttribute('href', '/projects');
  });

  it('shows error message', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/profiles/users/@me')) {
        return Promise.resolve(
          jsonResponse({
            user_id: 7,
            username: 'tester',
            role: 'single',
            profile_slug: 'tester',
            display_name: 'Test User',
            avatar_url: null,
            headline: 'QA Lead',
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 500 }));
    });

    renderWithClient(<ProfileView entity="areas" slug="beta" />);

    await waitFor(() => {
      const main = screen.getByRole('main');
      expect(within(main).getByText(/Ошибка/)).toBeInTheDocument();
    });
  });
});
