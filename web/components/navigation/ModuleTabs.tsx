'use client';

import clsx from 'clsx';
import Link from 'next/link';
import React from 'react';

export interface ModuleTabItem {
  key: string;
  label: string;
  href?: string;
  external?: boolean;
  hidden?: boolean;
  active?: boolean;
}

interface ModuleTabsProps {
  moduleLabel: string;
  items: ModuleTabItem[];
  className?: string;
}

export function ModuleTabs({ moduleLabel, items, className }: ModuleTabsProps) {
  if (!items || items.length <= 1) {
    return null;
  }

  return (
    <nav className={className} aria-label={`Навигация модуля ${moduleLabel}`}>
      {items.map((item) => {
        const baseClass =
          'inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--header-bg,var(--surface-0))]';
        const variant = item.active
          ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] shadow-soft'
          : 'bg-[color-mix(in srgb, var(--header-bg, var(--surface-0)) 12%, transparent)] text-[color-mix(in srgb, var(--header-text, var(--text-primary)) 80%, transparent)] hover:bg-[color-mix(in srgb, var(--accent-primary) 18%, transparent)] hover:text-[var(--header-text, var(--text-primary))] hover:underline decoration-2 underline-offset-8';
        const tabClassName = clsx(baseClass, variant);

        if (!item.href) {
          return (
            <span key={item.key} className={tabClassName} aria-disabled>
              {item.label}
            </span>
          );
        }

        if (item.external) {
          return (
          <a key={item.key} href={item.href} target="_blank" rel="noreferrer" className={tabClassName}>
            <span>{item.label}</span>
          </a>
          );
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            prefetch={false}
            className={tabClassName}
            aria-current={item.active ? 'page' : undefined}
          >
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default ModuleTabs;
