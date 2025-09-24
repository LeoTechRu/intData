'use client';

import clsx from 'clsx';
import Link from 'next/link';
import React from 'react';

import { NavIcon } from './NavIcon';

export interface SidebarModuleLink {
  id: string;
  label: string;
  icon?: string | null;
  href?: string | null;
}

export interface HiddenNavItemLink {
  key: string;
  label: string;
  href?: string | null;
  disabled?: boolean;
}

interface LeftSidebarProps {
  modules: SidebarModuleLink[];
  activeModuleId: string;
  onModuleSelect: (moduleId: string) => void;
  hiddenItems: HiddenNavItemLink[];
  hiddenExpanded: boolean;
  onToggleHidden: () => void;
}

export function LeftSidebar({
  modules,
  activeModuleId,
  onModuleSelect,
  hiddenItems,
  hiddenExpanded,
  onToggleHidden,
}: LeftSidebarProps) {
  const hasHidden = hiddenItems.length > 0;

  return (
    <aside
      className="relative flex h-full min-h-screen w-14 flex-col justify-between bg-[#f5f7fa] py-4 shadow-[1px_0_0_rgba(15,23,42,0.06)]"
      aria-label="Главные модули"
    >
      <div className="flex flex-col items-center gap-3">
        {modules.map((module) => {
          const isActive = module.id === activeModuleId;

          return (
            <button
              key={module.id}
              type="button"
              onClick={() => onModuleSelect(module.id)}
              className={clsx(
                'group relative flex h-12 w-12 items-center justify-center rounded-2xl text-slate-500 transition-colors duration-150',
                isActive ? 'bg-blue-100 text-blue-600' : 'hover:bg-blue-100 hover:text-blue-600',
              )}
              aria-pressed={isActive}
              aria-label={module.label}
              title={module.label}
            >
              <NavIcon name={module.icon ?? 'module-generic'} />
            </button>
          );
        })}
      </div>
      <div className="relative flex items-center justify-center">
        <button
          type="button"
          onClick={hasHidden ? onToggleHidden : undefined}
          className={clsx(
            'group flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition-colors duration-150',
            hasHidden
              ? hiddenExpanded
                ? 'bg-blue-100 text-blue-600'
                : 'hover:bg-blue-100 hover:text-blue-600'
              : 'cursor-default opacity-50',
          )}
          aria-haspopup="true"
          aria-expanded={hiddenExpanded}
          aria-label="Скрытые страницы"
          title="Скрытые страницы"
          disabled={!hasHidden}
        >
          <HiddenIcon />
        </button>
        {hiddenExpanded && hasHidden ? (
          <div className="absolute left-full z-30 ml-3 w-56 rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-lg">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Скрытые страницы</div>
            <ul className="flex flex-col gap-1 text-sm">
              {hiddenItems.map((item) => (
                <li key={item.key}>
                  {item.href && !item.disabled ? (
                    <Link
                      href={item.href}
                      prefetch={false}
                      className="inline-flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-blue-50 hover:text-blue-600"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="inline-flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-slate-400">
                      {item.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function HiddenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden
    >
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </svg>
  );
}

export default LeftSidebar;
