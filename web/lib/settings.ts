import { apiFetch } from './api';
import type {
  AdminBrandingSettings,
  AdminTelegramSettings,
  DashboardLayoutSettings,
  FavoriteOption,
  FavoritesSettings,
  ThemePreferences,
} from './types';

export interface UserSettingsBundle {
  dashboard_layout?: DashboardLayoutSettings | null;
  favorites?: FavoritesSettings | null;
  theme_preferences?: ThemePreferences | null;
  favorite_options?: FavoriteOption[] | null;
}

export interface GlobalThemeResponse {
  entries: Record<string, string>;
}

export interface AdminSettingsResponse {
  branding: AdminBrandingSettings;
  telegram: {
    TG_LOGIN_ENABLED: boolean;
    TG_BOT_USERNAME: string | null;
    TG_BOT_TOKEN: boolean;
  };
}

export async function fetchUserSettingsBundle(): Promise<UserSettingsBundle> {
  return apiFetch<UserSettingsBundle>(
    '/api/v1/user/settings?keys=dashboard_layout,favorites,theme_preferences,favorite_options',
  );
}

export async function updateDashboardLayout(value: DashboardLayoutSettings): Promise<void> {
  await apiFetch('/api/v1/user/settings/dashboard_layout', {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export async function updateFavorites(value: FavoritesSettings): Promise<void> {
  await apiFetch('/api/v1/user/settings/favorites', {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export async function updateThemePreferences(value: ThemePreferences | Record<string, never>): Promise<void> {
  await apiFetch('/api/v1/user/settings/theme_preferences', {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export async function fetchGlobalTheme(): Promise<GlobalThemeResponse> {
  return apiFetch<GlobalThemeResponse>('/api/v1/app-settings?prefix=theme.global.');
}

export async function updateGlobalThemeEntries(entries: Record<string, string>): Promise<void> {
  await apiFetch('/api/v1/app-settings', {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  });
}

export async function resetGlobalTheme(prefix = 'theme.global.'): Promise<void> {
  await apiFetch('/api/v1/app-settings', {
    method: 'PUT',
    body: JSON.stringify({ entries: {}, reset_prefix: prefix }),
  });
}

export async function fetchAdminSettings(): Promise<AdminSettingsResponse> {
  return apiFetch<AdminSettingsResponse>('/api/v1/admin/settings');
}

export async function updateAdminBranding(payload: AdminBrandingSettings): Promise<void> {
  await apiFetch('/api/v1/admin/settings/branding', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminTelegram(payload: AdminTelegramSettings): Promise<void> {
  await apiFetch('/api/v1/admin/settings/telegram', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function restartService(target: 'web' | 'bot'): Promise<{ ok: boolean; message?: string }> {
  const response = await apiFetch<{ ok: boolean; stderr?: string; error?: string }>(
    `/api/v1/admin/restart?target=${target}`,
    { method: 'POST' },
  );
  if (!response.ok) {
    const message = response.error || response.stderr || 'Не удалось перезапустить сервис';
    return { ok: false, message };
  }
  return { ok: true };
}
