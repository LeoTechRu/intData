'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { ModuleTabs, type ModuleTabItem } from './ModuleTabs';
import type { ViewerProfileSummary } from '../../lib/types';
import { DEFAULT_PERSONA_BUNDLE, getPersonaInfo, type PersonaBundle } from '../../lib/persona';

interface TopNavBarProps {
  moduleLabel: string;
  tabs: ModuleTabItem[];
  viewer: ViewerProfileSummary | null;
  viewerLoading: boolean;
  personaBundle?: PersonaBundle;
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
}

export function TopNavBar({
  moduleLabel,
  tabs,
  viewer,
  viewerLoading,
  personaBundle,
  onToggleSidebar,
  isSidebarCollapsed,
}: TopNavBarProps) {
  return (
    <header className="relative flex h-12 items-center gap-3 bg-[var(--header-bg,#0b66ff)] px-3 text-white shadow-sm">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        aria-label={isSidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
      >
        <BurgerIcon />
      </button>
      <ModuleTabs
        moduleLabel={moduleLabel}
        items={tabs}
        className="flex min-w-0 flex-1 items-center gap-1"
      />
      <UserSummary viewer={viewer} isLoading={viewerLoading} personaBundle={personaBundle} />
    </header>
  );
}

function UserSummary({
  viewer,
  isLoading,
  personaBundle,
}: {
  viewer: ViewerProfileSummary | null;
  isLoading: boolean;
  personaBundle?: PersonaBundle;
}) {
  if (isLoading && !viewer) {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-white/30" aria-hidden />;
  }
  if (!viewer) {
    return null;
  }
  const displayLabel = viewer.display_name || viewer.username || 'Пользователь';
  const initials = getInitials(displayLabel);
  const persona = getPersonaInfo(personaBundle ?? DEFAULT_PERSONA_BUNDLE, viewer.role);
  const profileSlug = viewer.profile_slug || viewer.username || '';
  const profileHref = profileSlug ? `/users/${profileSlug}` : '/users';
  const usernameLabel = viewer.username ? `@${viewer.username}` : '—';

  return (
    <Link
      href={profileHref}
      prefetch={false}
      className="group inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      aria-label={`Профиль пользователя ${displayLabel}`}
      title={persona.label}
    >
      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-[#0b66ff]">
        {viewer.avatar_url ? (
          <Image
            src={viewer.avatar_url}
            alt="Аватар пользователя"
            width={32}
            height={32}
            className="h-8 w-8 object-cover"
            unoptimized
          />
        ) : (
          initials
        )}
      </span>
      <span className="hidden min-w-0 flex-col leading-tight sm:flex">
        <span className="truncate text-xs font-semibold text-white">{displayLabel}</span>
        <span className="truncate text-[11px] text-white/70">{usernameLabel}</span>
      </span>
    </Link>
  );
}

function BurgerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) {
    return 'ID';
  }
  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .padEnd(2, '•');
}

export default TopNavBar;
