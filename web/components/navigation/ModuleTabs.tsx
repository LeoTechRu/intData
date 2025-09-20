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
          'inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]';
        const variant = item.active
          ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] shadow-soft'
          : item.hidden
          ? 'border border-dashed border-subtle text-muted hover:text-[var(--text-primary)]'
          : 'bg-surface-soft text-muted hover:text-[var(--text-primary)]';
        const tabClassName = clsx(baseClass, variant);

        if (!item.href) {
          return (
            <span key={item.key} className={tabClassName} aria-disabled>
              {item.label}
              {item.hidden ? (
                <span className="text-[10px] uppercase tracking-wide text-muted">Скрыто</span>
              ) : null}
            </span>
          );
        }

        if (item.external) {
          return (
            <a key={item.key} href={item.href} target="_blank" rel="noreferrer" className={tabClassName}>
              <span>{item.label}</span>
              {item.hidden ? (
                <span className="text-[10px] uppercase tracking-wide text-muted">Скрыто</span>
              ) : null}
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
            {item.hidden ? (
              <span className="text-[10px] uppercase tracking-wide text-muted">Скрыто</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export default ModuleTabs;
