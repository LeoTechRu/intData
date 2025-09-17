import React, { type HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'accent' | 'neutral' | 'success' | 'warning';
  size?: 'sm' | 'md';
  uppercase?: boolean;
}

export function Badge({
  tone = 'accent',
  size = 'md',
  uppercase = true,
  className,
  children,
  ...props
}: BadgeProps) {
  const toneClass =
    tone === 'accent'
      ? 'bg-[var(--accent-primary-soft)] text-[var(--text-primary)]'
      : tone === 'success'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'warning'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-surface-soft text-muted';
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[0.65rem]' : 'px-3 py-1 text-xs';
  return (
    <span
      className={cn('inline-flex items-center rounded-full font-medium tracking-wide', uppercase && 'uppercase', toneClass, sizeClass, className)}
      {...props}
    >
      {children}
    </span>
  );
}
