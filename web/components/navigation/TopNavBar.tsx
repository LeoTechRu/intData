'use client';

import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import { ModuleTabs, type ModuleTabItem } from './ModuleTabs';
import type { ViewerProfileSummary } from '../../lib/types';
import { DEFAULT_PERSONA_BUNDLE, getPersonaInfo, type PersonaBundle } from '../../lib/persona';

interface TopNavBarProps {
  moduleLabel: string;
  tabs: ModuleTabItem[];
  viewer: ViewerProfileSummary | null;
  viewerLoading: boolean;
  personaBundle?: PersonaBundle;
}

export function TopNavBar({ moduleLabel, tabs, viewer, viewerLoading, personaBundle }: TopNavBarProps) {
  return (
    <div className="flex h-12 items-center gap-4 bg-[#0065ff] px-4 text-white">
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        <ModuleTabs moduleLabel={moduleLabel} items={tabs} className="flex flex-1 items-center gap-2" />
      </div>
      <div className="flex items-center gap-3">
        <UserSummary viewer={viewer} isLoading={viewerLoading} personaBundle={personaBundle} />
      </div>
    </div>
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
    return <div className="h-10 w-10 animate-pulse rounded-full bg-white/15" aria-hidden />;
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
      className="group inline-flex items-center gap-3 rounded-full border border-white/20 px-2 py-1 transition-colors hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-500"
      aria-label={`Профиль пользователя ${displayLabel}`}
      title={persona.label}
    >
      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/15 text-sm font-semibold text-white ring-1 ring-white/40">
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
        <span className="truncate text-sm font-medium text-white">{displayLabel}</span>
        <span className="truncate text-xs text-white/70">{usernameLabel}</span>
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

export default TopNavBar;
