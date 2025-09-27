import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ModuleTabs, type ModuleTabItem } from './ModuleTabs';

describe('ModuleTabs', () => {
  afterEach(() => cleanup());

  it('renders single tab as static pill when only one entry provided', () => {
    render(<ModuleTabs moduleLabel="Задачи" items={[{ key: 'tasks', label: 'Задачи', active: true }]} />);

    expect(screen.getByRole('navigation', { name: 'Навигация модуля Задачи' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Задачи' })).toHaveAttribute('aria-disabled', 'true');
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
    expect(screen.getByRole('tab', { name: 'Проекты' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('tab', { name: 'Документация' })).toHaveAttribute(
      'href',
      'https://docs.example.com',
    );
    expect(screen.getByRole('tab', { name: 'Ресурсы' })).toHaveAttribute('href', '/resources');
  });
});
