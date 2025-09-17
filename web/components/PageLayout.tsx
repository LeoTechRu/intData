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
  headingLevel?: 1 | 2;
  hideContentTitle?: boolean;
  children: ReactNode;
}

export default function PageLayout({
  title,
  subtitle,
  description,
  actions,
  contentClassName,
  headingLevel = 2,
  hideContentTitle = false,
  children,
}: PageLayoutProps) {
  const shellHeadingId = 'app-shell-title';
  const contentHeadingId = 'page-section-title';
  const labelledBy = hideContentTitle ? shellHeadingId : contentHeadingId;
  const HeadingTag = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <AppShell title={title} subtitle={subtitle} actions={actions} titleId={shellHeadingId}>
      <Section
        className={cn('p-6 md:p-8', contentClassName)}
        spacing="lg"
        aria-labelledby={labelledBy}
        data-testid="page-layout"
      >
        <header
          className={cn('flex flex-col gap-2', hideContentTitle && 'sr-only')}
          aria-hidden={hideContentTitle}
        >
          <HeadingTag
            id={contentHeadingId}
            className="text-xl font-semibold tracking-tight text-[var(--text-primary)]"
            data-testid="page-title"
          >
            {title}
          </HeadingTag>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </header>
        {children}
      </Section>
    </AppShell>
  );
}
