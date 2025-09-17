import React, { type ReactNode } from 'react';
import AppShell from './AppShell';
import { cn } from '../lib/cn';
import { Section } from './ui/Section';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  description?: string;
  actions?: ReactNode;
  contentClassName?: string;
  children: ReactNode;
}

export default function PageLayout({
  title,
  subtitle,
  description,
  actions,
  contentClassName,
  children,
}: PageLayoutProps) {
  return (
    <AppShell title={title} subtitle={subtitle} actions={actions}>
      <Section
        className={cn('p-6 md:p-8', contentClassName)}
        spacing="lg"
        aria-labelledby="page-title"
        data-testid="page-layout"
      >
        <header className="flex flex-col gap-2">
          <h1
            id="page-title"
            className="text-xl font-semibold tracking-tight text-[var(--text-primary)]"
            data-testid="page-title"
          >
            {title}
          </h1>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </header>
        {children}
      </Section>
    </AppShell>
  );
}
