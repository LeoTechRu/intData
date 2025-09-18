'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import UsersCatalog from './UsersCatalog';
import ProfileView from '../profile/ProfileView';

function resolveSlug(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(raw)) {
    const candidate = raw.find((value) => typeof value === 'string' && value.trim().length > 0);
    return candidate ? String(candidate) : null;
  }
  if (raw == null) {
    return null;
  }
  const value = String(raw).trim();
  return value.length > 0 ? value : null;
}

export default function UsersRouteView() {
  const params = useParams();
  const slug = useMemo(() => resolveSlug((params as Record<string, unknown> | undefined)?.slug), [params]);

  if (!slug) {
    return <UsersCatalog />;
  }

  return <ProfileView entity="users" slug={slug} backHref="/users" backLabel="← К каталогу" />;
}
