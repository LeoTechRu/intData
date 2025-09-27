'use client';

import clsx from 'clsx';
import Link from 'next/link';
import React, { useMemo, useRef } from 'react';

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
  const entries = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const listRef = useRef<HTMLDivElement | null>(null);

  if (entries.length === 0) {
    return null;
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }
    const container = listRef.current;
    if (!container) {
      return;
    }
    const tabElements = Array.from(
      container.querySelectorAll<HTMLElement>('[data-module-tab-element="true"]:not([aria-disabled="true"])'),
    );
    if (tabElements.length === 0) {
      return;
    }
    const activeIndex = tabElements.findIndex((el) => el === document.activeElement);
    let nextIndex = activeIndex;
    if (event.key === 'ArrowRight') {
      nextIndex = activeIndex === -1 ? 0 : (activeIndex + 1) % tabElements.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = activeIndex <= 0 ? tabElements.length - 1 : activeIndex - 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabElements.length - 1;
    }
    event.preventDefault();
    const target = tabElements[nextIndex];
    target?.focus({ preventScroll: false });
  };

  return (
    <nav
      className={clsx('relative flex min-w-0 flex-1 items-center overflow-hidden', className)}
      aria-label={`Навигация модуля ${moduleLabel}`}
      role="navigation"
    >
      <div
        ref={listRef}
        className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1"
        onKeyDown={handleKeyDown}
        role="tablist"
        aria-label={`Переключение вкладок модуля ${moduleLabel}`}
      >
        {entries.map((item) => {
          const baseClass =
            'inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70';
          const variant = item.active
            ? 'bg-white text-[#0b66ff] shadow-sm'
            : 'bg-white/5 text-white/80 hover:bg-white/15 hover:text-white';
          const hiddenVariant = item.hidden ? 'opacity-70 hover:opacity-90' : '';
          const tabClassName = clsx(baseClass, variant, hiddenVariant);

          if (!item.href) {
            return (
              <span
                key={item.key}
                className={tabClassName}
                aria-disabled="true"
                role="tab"
                aria-selected={item.active || undefined}
                data-module-tab-element="true"
                tabIndex={0}
              >
                {item.label}
              </span>
            );
          }

          if (item.external) {
            return (
              <a
                key={item.key}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className={tabClassName}
                role="tab"
                aria-selected={item.active || undefined}
                data-module-tab-element="true"
                tabIndex={item.active ? 0 : -1}
              >
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
              role="tab"
              aria-selected={item.active || undefined}
              aria-current={item.active ? 'page' : undefined}
              data-module-tab-element="true"
              tabIndex={item.active ? 0 : -1}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[rgba(0,0,0,0.15)] to-transparent" aria-hidden />
    </nav>
  );
}

export default ModuleTabs;
