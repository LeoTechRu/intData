import React, { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Card } from './Card';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon, className, ...props }: EmptyStateProps) {
  return (
    <Card
      as="article"
      padded
      surface="soft"
      className={cn('flex flex-col items-start gap-3 text-sm text-muted', className)}
      {...props}
    >
      {icon ? <div className="text-2xl" aria-hidden>{icon}</div> : null}
      <div className="text-base font-semibold text-[var(--text-primary)]">{title}</div>
      {description ? <p>{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </Card>
  );
}
