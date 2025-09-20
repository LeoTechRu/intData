import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ModuleTabs, type ModuleTabItem } from './ModuleTabs';

describe('ModuleTabs', () => {
  it('returns null when there are fewer than two tabs', () => {
    const { container } = render(
      <ModuleTabs moduleLabel="Задачи" items={[{ key: 'tasks', label: 'Задачи', active: true }]} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders internal and external tabs with hidden marker', () => {
    const items: ModuleTabItem[] = [
      { key: 'projects', label: 'Проекты', href: '/projects', active: true },
      { key: 'resources', label: 'Ресурсы', href: '/resources', hidden: true },
      {
        key: 'docs',
        label: 'Документация',
        href: 'https://docs.example.com',
        external: true,
      },
    ];

    render(<ModuleTabs moduleLabel="Задачи" items={items} />);

    expect(screen.getByRole('navigation', { name: 'Навигация модуля Задачи' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Проекты' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: 'Документация' })).toHaveAttribute(
      'href',
      'https://docs.example.com',
    );
    expect(screen.getByText('Скрыто')).toBeInTheDocument();
  });
});
