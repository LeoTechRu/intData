import { apiFetch } from './api';
import type { SidebarNavPayload, SidebarLayoutSettings } from './types';

export interface UpdateSidebarLayoutPayload {
  layout?: SidebarLayoutSettings | null;
  reset?: boolean;
}

export async function fetchSidebarNav(): Promise<SidebarNavPayload> {
  return apiFetch<SidebarNavPayload>('/api/v1/navigation/sidebar');
}

export async function updateUserSidebarLayout(payload: UpdateSidebarLayoutPayload): Promise<SidebarNavPayload> {
  const response = await apiFetch<{ ok: boolean; payload: SidebarNavPayload }>(
    '/api/v1/navigation/sidebar/user',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
  return response.payload;
}

export async function updateGlobalSidebarLayout(payload: UpdateSidebarLayoutPayload): Promise<void> {
  await apiFetch('/api/v1/navigation/sidebar/global', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
