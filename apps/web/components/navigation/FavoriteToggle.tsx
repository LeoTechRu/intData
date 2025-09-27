'use client';

import React from 'react';

interface FavoriteToggleProps {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void | Promise<void>;
  labelAdd: string;
  labelRemove: string;
}

export function FavoriteToggle({ active, disabled, onToggle, labelAdd, labelRemove }: FavoriteToggleProps) {
  const ariaLabel = active ? labelRemove : labelAdd;

  const handleClick = () => {
    if (disabled) {
      return;
    }
    void onToggle();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-base hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:opacity-40"
    >
      <svg
        aria-hidden
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.6}
      >
        <path
          d="M12 3.25l2.317 4.695 5.182.753-3.75 3.655.886 5.168L12 15.986l-4.635 2.53.886-5.168-3.75-3.655 5.182-.753L12 3.25z"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

export default FavoriteToggle;
