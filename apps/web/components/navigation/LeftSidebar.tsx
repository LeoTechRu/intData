'use client';

import clsx from 'clsx';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';

import { NavIcon } from './NavIcon';
import type { SidebarModuleGroup } from '../../lib/navigation-helpers';
import type { SidebarNavItem } from '../../lib/types';

interface LeftSidebarProps {
  moduleGroups: SidebarModuleGroup<SidebarNavItem>[];
  activeModuleId: string;
  onModuleSelect: (moduleId: string) => void;
  hiddenItems: SidebarNavItem[];
  onUnhide: (key: string) => void;
  onConfigure: () => void;
  isCollapsed: boolean;
  canConfigure: boolean;
  isLoading?: boolean;
  onToggleCollapse: () => void;
}

export function LeftSidebar({
  moduleGroups,
  activeModuleId,
  onModuleSelect,
  hiddenItems,
  onUnhide,
  onConfigure,
  isCollapsed,
  canConfigure,
  isLoading,
  onToggleCollapse,
}: LeftSidebarProps) {
  const [isHiddenExpanded, setHiddenExpanded] = useState(false);

  const activeModule = moduleGroups.find((group) => group.id === activeModuleId) ?? moduleGroups[0];
  const visibleActiveItems = useMemo(() => {
    if (!activeModule) {
      return [] as SidebarNavItem[];
    }
    return activeModule.categories.flatMap(({ items }) => items.filter((item) => !item.hidden));
  }, [activeModule]);

  useEffect(() => {
    if (!isCollapsed && isHiddenExpanded) {
      setHiddenExpanded(false);
    }
  }, [isCollapsed, isHiddenExpanded]);

  const sidebarClassName = clsx(
    'relative flex h-full min-h-screen flex-col border-r border-slate-200 bg-[#f5f7fa] transition-all duration-200 ease-out',
    isCollapsed ? 'w-[56px]' : 'w-[248px] shadow-[1px_0_0_rgba(15,23,42,0.06)]',
  );

  return (
    <aside className={sidebarClassName} aria-label="Основная навигация">
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className={clsx('flex items-center gap-3 px-2 pt-4', isCollapsed ? 'justify-center' : 'justify-between pr-3')}>
          <button
            type="button"
            onClick={onToggleCollapse}
            className={clsx(
              'inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#0b66ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200',
              isCollapsed && 'h-10 w-10'
            )}
            aria-label={isCollapsed ? 'Развернуть левое меню' : 'Свернуть левое меню'}
          >
            <BurgerIcon />
          </button>
          {isCollapsed ? null : (
            <span className="text-sm font-semibold uppercase tracking-wide text-slate-400">Меню</span>
          )}
        </div>
        <nav aria-label="Модули">
          <ul className="flex flex-col gap-1 px-2 pt-4 pb-4">
            {moduleGroups.map((module) => {
              const isActive = module.id === activeModuleId;
              return (
                <li key={module.id}>
                  <button
                    type="button"
                    className={clsx(
                      'group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200',
                      isActive
                        ? 'bg-[rgba(11,102,255,0.12)] text-[#0b66ff]'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-[#0b66ff] focus-visible:ring-offset-1',
                      isCollapsed && 'justify-center px-0',
                    )}
                    onClick={() => onModuleSelect(module.id)}
                    aria-pressed={isActive}
                    aria-label={module.label}
                    title={module.label}
                  >
                    <span
                      className={clsx(
                        'flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-colors',
                        isActive ? 'bg-white text-[#0b66ff]' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[#0b66ff]',
                      )}
                    >
                      <NavIcon name={module.icon ?? 'module-generic'} className="h-4 w-4" />
                    </span>
                    {isCollapsed ? null : <span className="truncate text-sm">{module.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        {!isCollapsed && visibleActiveItems.length > 0 ? (
          <div className="mt-2 border-t border-slate-200 px-4 pt-3" aria-label="Страницы модуля">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Страницы</div>
            <ul className="flex flex-col gap-1">
              {visibleActiveItems.map((item) => (
                <li key={item.key}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      prefetch={false}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-[rgba(11,102,255,0.12)] hover:text-[#0b66ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                    >
                      <NavIcon name={item.icon ?? 'nav-generic'} className="h-4 w-4 text-slate-400" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400">
                      <NavIcon name={item.icon ?? 'nav-generic'} className="h-4 w-4 text-slate-300" />
                      <span className="truncate">{item.label}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="border-t border-slate-200 px-3 py-3">
        {canConfigure ? (
          <button
            type="button"
            onClick={onConfigure}
            className={clsx(
              'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#0b66ff]/50 px-3 py-2 text-sm font-medium text-[#0b66ff] transition-colors',
              'hover:bg-[#0b66ff]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1',
              isCollapsed && 'h-10 px-0 text-[0px]'
            )}
            aria-label="Настроить меню"
            title="Настроить меню"
          >
            <ConfigureIcon />
            {isCollapsed ? null : <span>Настроить меню</span>}
          </button>
        ) : null}
        <HiddenSection
          items={hiddenItems}
          onUnhide={onUnhide}
          expanded={isHiddenExpanded}
          onToggle={() => setHiddenExpanded((prev) => !prev)}
          collapsed={isCollapsed}
        />
      </div>
      {isLoading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/40">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0b66ff] border-t-transparent" />
        </div>
      ) : null}
    </aside>
  );
}

interface HiddenSectionProps {
  items: SidebarNavItem[];
  onUnhide: (key: string) => void;
  expanded: boolean;
  onToggle: () => void;
  collapsed: boolean;
}

function HiddenSection({ items, onUnhide, expanded, onToggle, collapsed }: HiddenSectionProps) {
  const hasHidden = items.length > 0;

  if (!hasHidden) {
    return null;
  }

  if (collapsed) {
    return (
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={onToggle}
          className={clsx(
            'flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#0b66ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200',
            expanded && 'bg-[rgba(11,102,255,0.12)] text-[#0b66ff]'
          )}
          aria-haspopup="true"
          aria-expanded={expanded}
          aria-label="Скрытые страницы"
          title="Скрытые страницы"
        >
          <HiddenIcon />
        </button>
        {expanded ? (
          <div className="absolute left-full bottom-0 z-40 ml-3 w-56 rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl">
            <HiddenList items={items} onUnhide={onUnhide} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl bg-white p-3 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-sm font-medium text-slate-600"
        aria-expanded={expanded}
      >
        <span>Скрытые страницы</span>
        <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[rgba(11,102,255,0.12)] px-2 text-xs font-semibold text-[#0b66ff]">
          {items.length}
        </span>
      </button>
      {expanded ? <HiddenList items={items} onUnhide={onUnhide} className="mt-3" /> : null}
    </div>
  );
}

function HiddenList({
  items,
  onUnhide,
  className,
}: {
  items: SidebarNavItem[];
  onUnhide: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Скрытые страницы</div>
      <ul className="flex flex-col gap-1 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onUnhide(item.key)}
              className="flex w-full items-center justify-between rounded-lg bg-slate-100 px-3 py-1.5 text-left transition-colors hover:bg-[rgba(11,102,255,0.12)] hover:text-[#0b66ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            >
              <span className="truncate">{item.label}</span>
              <RestoreIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConfigureIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.5-3.5a7.5 7.5 0 0 0-.17-1.54l2.06-1.6-2-3.46-2.45 1a7.52 7.52 0 0 0-2.68-1.55l-.37-2.6H10.1l-.37 2.6a7.52 7.52 0 0 0-2.68 1.55l-2.45-1-2 3.46 2.06 1.6A7.5 7.5 0 0 0 4.5 12a7.5 7.5 0 0 0 .17 1.54l-2.06 1.6 2 3.46 2.45-1a7.52 7.52 0 0 0 2.68 1.55l.37 2.6h4.06l.37-2.6a7.52 7.52 0 0 0 2.68-1.55l2.45 1 2-3.46-2.06-1.6c.11-.5.17-1.02.17-1.54Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HiddenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}

function BurgerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <path d="M12 5v6l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 4a8 8 0 1 0 8 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default LeftSidebar;
