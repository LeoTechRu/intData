'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { ModuleTabs, type ModuleTabItem } from './ModuleTabs';
import type { ViewerProfileSummary } from '../../lib/types';
import { DEFAULT_PERSONA_BUNDLE, getPersonaInfo, type PersonaBundle } from '../../lib/persona';

interface ModuleTabsBarProps {
  moduleLabel: string;
  tabs: ModuleTabItem[];
  viewer: ViewerProfileSummary | null;
  viewerLoading: boolean;
  personaBundle?: PersonaBundle;
}

export function ModuleTabsBar({ moduleLabel, tabs, viewer, viewerLoading, personaBundle }: ModuleTabsBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-100 bg-white/95 px-4 shadow-sm backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <ModuleBadge label={moduleLabel} />
        <ModuleTabs
          moduleLabel={moduleLabel}
          items={tabs}
          className="flex min-w-0 flex-1 items-center gap-2"
        />
      </div>
      <UserSummary viewer={viewer} isLoading={viewerLoading} personaBundle={personaBundle} />
    </header>
  );
}

function ModuleBadge({ label }: { label?: string | null }) {
  if (!label) {
    return null;
  }
  return (
    <span className="hidden whitespace-nowrap rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600 sm:inline-flex">
      {label}
    </span>
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
    return <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" aria-hidden />;
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
      className="group inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm transition-colors hover:border-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
      aria-label={`Профиль пользователя ${displayLabel}`}
      title={persona.label}
    >
      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-sm font-semibold text-blue-600 ring-1 ring-inset ring-blue-200">
        {viewer.avatar_url ? (
          <Image
            src={viewer.avatar_url}
            alt="Аватар пользователя"
            width={40}
            height={40}
            className="h-10 w-10 object-cover"
            unoptimized
          />
        ) : (
          initials
        )}
      </span>
      <span className="hidden min-w-0 flex-col leading-tight sm:flex">
        <span className="truncate text-sm font-medium text-slate-800">{displayLabel}</span>
        <span className="truncate text-xs text-slate-500">{usernameLabel}</span>
      </span>
    </Link>
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

export default ModuleTabsBar;
