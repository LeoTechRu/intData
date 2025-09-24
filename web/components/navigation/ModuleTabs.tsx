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
  const entries = Array.isArray(items) ? items : [];

  if (entries.length <= 1) {
    return null;
  }

  return (
    <nav className={clsx('flex flex-wrap items-center gap-2', className)} aria-label={`Навигация модуля ${moduleLabel}`}>
      {entries.map((item) => {
        const baseClass =
          'inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600';
        const variant = item.active
          ? 'bg-white text-blue-600 shadow-sm'
          : 'text-white/80 hover:bg-white/15 hover:text-white';
        const hiddenVariant = item.hidden ? 'opacity-70 hover:opacity-90' : '';
        const tabClassName = clsx(baseClass, variant, hiddenVariant);

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
