import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FavoriteToggle } from './FavoriteToggle';

describe('FavoriteToggle', () => {
  it('calls onToggle when clicked and updates aria-label', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <FavoriteToggle
        active={false}
        onToggle={onToggle}
        labelAdd="Закрепить страницу"
        labelRemove="Убрать страницу"
      />,
    );

    const button = screen.getByRole('button', { name: 'Закрепить страницу' });
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <FavoriteToggle
        active
        onToggle={onToggle}
        labelAdd="Закрепить страницу"
        labelRemove="Убрать страницу"
      />,
    );

    expect(screen.getByRole('button', { name: 'Убрать страницу' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('does not trigger onToggle when disabled', () => {
    const onToggle = vi.fn();
    render(
      <FavoriteToggle
        active={false}
        disabled
        onToggle={onToggle}
        labelAdd="Закрепить"
        labelRemove="Убрать"
      />,
    );

    const button = screen.getByRole('button', { name: 'Закрепить' });
    fireEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
