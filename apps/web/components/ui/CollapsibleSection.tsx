'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import React from 'react';

import { cn } from '../../lib/cn';

interface CollapsibleSectionProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  subtitle?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  contentClassName?: string;
  headerClassName?: string;
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className={cn(
        'h-4 w-4 shrink-0 transform transition-transform duration-300',
        open ? 'rotate-180 text-[var(--text-primary)]' : 'text-muted',
      )}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.108l3.71-2.88a.75.75 0 1 1 .92 1.18l-4.166 3.23a.75.75 0 0 1-.92 0L5.25 8.4a.75.75 0 0 1-.02-1.19z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
  className,
  contentClassName,
  headerClassName,
  ...rest
}: CollapsibleSectionProps) {
  return (
    <section
      className={cn('rounded-2xl border border-subtle bg-[var(--surface-0)] shadow-soft', className)}
      {...rest}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-[var(--surface-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]',
          headerClassName,
        )}
        aria-expanded={open}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
          {subtitle ? <span className="text-xs text-muted">{subtitle}</span> : null}
        </div>
        <ChevronDownIcon open={open} />
      </button>
      <div
        className={cn(
          'grid transition-all duration-300 ease-in-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            'overflow-hidden px-4 pb-4',
            open ? 'pt-2 opacity-100' : 'h-0 pt-0 opacity-0',
            'transition-all duration-300 ease-in-out',
            contentClassName,
          )}
        >
          {open ? children : null}
        </div>
      </div>
    </section>
  );
}

CollapsibleSection.displayName = 'CollapsibleSection';
