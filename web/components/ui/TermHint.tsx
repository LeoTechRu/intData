'use client';

import React, { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface TermHintProps {
  label: ReactNode;
  description: ReactNode;
  icon?: boolean;
  className?: string;
  tooltipClassName?: string;
  placement?: 'top' | 'bottom';
}

export function TermHint({
  label,
  description,
  icon = true,
  className,
  tooltipClassName,
  placement = 'bottom',
}: TermHintProps) {
  const reactId = useId();
  const tooltipId = `${reactId}-hint`;

  return (
    <span
      className={cn(
        'group relative inline-flex cursor-help items-center gap-1 text-[var(--text-primary)] focus-visible:outline-none',
        className,
      )}
      tabIndex={0}
      aria-describedby={tooltipId}
    >
      <span>{label}</span>
      {icon ? (
        <span
          aria-hidden
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-subtle text-[10px] font-semibold text-muted transition-colors group-hover:border-[var(--accent-primary)] group-hover:text-[var(--accent-primary)] group-focus-visible:border-[var(--accent-primary)] group-focus-visible:text-[var(--accent-primary)]"
        >
          ?
        </span>
      ) : null}
      <span
        role="tooltip"
        id={tooltipId}
        className={cn(
          'pointer-events-none absolute left-1/2 z-20 hidden max-w-xs rounded-2xl border border-subtle bg-[var(--surface-0)] px-3 py-2 text-xs leading-relaxed text-[var(--text-primary)] shadow-xl group-hover:flex group-focus-visible:flex',
          placement === 'top'
            ? 'bottom-full -translate-x-1/2 -translate-y-2'
            : 'top-full -translate-x-1/2 translate-y-2',
          tooltipClassName,
        )}
      >
        {description}
      </span>
    </span>
  );
}
