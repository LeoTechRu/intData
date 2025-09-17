import React, { type HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  justify?: 'start' | 'between' | 'end';
}

export function Toolbar({ justify = 'between', className, children, ...props }: ToolbarProps) {
  const justifyClass =
    justify === 'start' ? 'justify-start' : justify === 'end' ? 'justify-end' : 'justify-between';
  return (
    <div
      className={cn('flex flex-wrap items-center gap-3 rounded-2xl border border-subtle bg-surface-soft px-4 py-3', justifyClass, className)}
      {...props}
    >
      {children}
    </div>
  );
}
