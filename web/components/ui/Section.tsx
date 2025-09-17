import React, { type HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  spacing?: 'none' | 'sm' | 'md' | 'lg';
}

const spacingMap: Record<Required<SectionProps>['spacing'], string> = {
  none: 'gap-0',
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
};

export function Section({ spacing = 'md', className, children, ...props }: SectionProps) {
  return (
    <section className={cn('flex flex-col', spacingMap[spacing], className)} {...props}>
      {children}
    </section>
  );
}
