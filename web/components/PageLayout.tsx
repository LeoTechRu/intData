import React, { type ReactNode } from 'react';
import AppShell from './AppShell';

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
    <AppShell title={title} subtitle={subtitle} description={description} actions={actions}>
      <div className={contentClassName ?? 'flex flex-col gap-4 p-6 md:p-8'}>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]" data-testid="page-title">
          {title}
        </h1>
        {children}
      </div>
    </AppShell>
  );
}
