import React, { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  surface?: 'default' | 'soft';
  as?: 'div' | 'section' | 'article';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padded = true, surface = 'default', as = 'section', ...props }, ref) => {
    const Comp = as;
    return (
      <Comp
        ref={ref as never}
        className={cn(
          'rounded-2xl border border-subtle shadow-soft',
          surface === 'soft' ? 'bg-surface-soft' : 'bg-[var(--surface-0)]',
          padded && 'p-6',
          className,
        )}
        {...props}
      />
    );
  },
);

Card.displayName = 'Card';
