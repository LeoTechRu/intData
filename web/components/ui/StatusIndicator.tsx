'use client';

import clsx from 'clsx';
import Link from 'next/link';
import React from 'react';

export type StatusIndicatorKind = 'new' | 'wip' | 'locked';

export interface StatusIndicatorProps {
  kind: StatusIndicatorKind;
  tooltip?: string;
  href?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const KIND_STYLES: Record<StatusIndicatorKind, string> = {
  new: 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]',
  wip: 'bg-amber-100 text-amber-600 dark:bg-amber-200/20 dark:text-amber-200',
  locked: 'bg-slate-200 text-slate-600 dark:bg-slate-200/10 dark:text-slate-200',
};

const KIND_TITLES: Record<StatusIndicatorKind, string> = {
  new: 'Новый раздел — попробуйте обновлённый интерфейс',
  wip: 'Раздел ещё в разработке — возможны изменения',
  locked: 'Доступ по тарифу — откройте страницу тарифов, чтобы прокачать доступ',
};

function renderIcon(kind: StatusIndicatorKind, size: number) {
  switch (kind) {
    case 'wip':
      return (
        <svg aria-hidden className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h6l2-3 2 3h6v12H4z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 12h4" />
        </svg>
      );
    case 'locked':
      return (
        <svg aria-hidden className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V8a4 4 0 118 0v3" />
        </svg>
      );
    case 'new':
    default:
      return (
        <svg aria-hidden className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 4.6L19 9l-4 3.4.9 5.3L12 15.8 8.1 17.7 9 12.4 5 9l5.1-1.4z" />
        </svg>
      );
  }
}

export function StatusIndicator({ kind, tooltip, href, size = 'sm', className }: StatusIndicatorProps) {
  const dimension = size === 'sm' ? 18 : 22;
  const label = tooltip ?? KIND_TITLES[kind];
  const content = (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-full border border-transparent p-1 transition-colors hover:border-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-0)]',
        KIND_STYLES[kind],
        className,
      )}
      title={label}
      aria-label={label}
      role="img"
      tabIndex={-1}
    >
      <span className="block" style={{ width: dimension, height: dimension }}>
        {renderIcon(kind, dimension)}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        prefetch={false}
        className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
        aria-label={label}
        title={label}
      >
        {content}
      </Link>
    );
  }

  return content;
}
