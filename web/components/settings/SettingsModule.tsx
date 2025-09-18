'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { Section } from '../ui/Section';
import { Select } from '../ui/Select';
import AreasManager from '../areas/AreasManager';
import type {
  ThemeMode,
  ThemePreferences,
  ThemePreset,
  AdminBrandingSettings,
  AdminTelegramSettings,
  ViewerProfileSummary,
} from '../../lib/types';
import {
  fetchUserSettingsBundle,
  updateThemePreferences,
  fetchGlobalTheme,
  updateGlobalThemeEntries,
  resetGlobalTheme,
  fetchAdminSettings,
  updateAdminBranding,
  updateAdminTelegram,
  restartService,
  updateTimezoneSetting,
} from '../../lib/settings';
import type { UserSettingsBundle } from '../../lib/settings';
import {
  DEFAULT_THEME,
  clearThemeLayer,
  entriesFromTheme,
  getActiveTheme,
  normalizeThemeHex,
  pickContrast,
  setThemeLayer,
  themeFromEntries,
  themeFromUserSettings,
} from '../../lib/theme';



const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'aurora',
    label: 'Aurora',
    mode: 'light',
    primary: '#2563EB',
    accent: '#A855F7',
    gradient: { from: '#6366F1', to: '#8B5CF6' },
  },
  {
    id: 'sunrise',
    label: 'Sunrise',
    mode: 'light',
    primary: '#F97316',
    accent: '#FB7185',
    gradient: { from: '#FACC15', to: '#F97316' },
  },
  {
    id: 'noir',
    label: 'Noir',
    mode: 'dark',
    primary: '#0EA5E9',
    accent: '#6366F1',
    surface: '#111827',
    gradient: { from: '#0F172A', to: '#1F2937' },
  },
  {
    id: 'forest',
    label: 'Forest',
    mode: 'system',
    primary: '#16A34A',
    accent: '#22D3EE',
    gradient: { from: '#134E4A', to: '#0F766E' },
  },
];

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type ThemeLayer = 'user' | 'global';

const MODE_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: 'Авто (по системе)' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
];

function useViewerRole(): string | null {
  const queryClient = useQueryClient();
  const viewer = queryClient.getQueryData<ViewerProfileSummary | null>(['viewer-profile-summary']);
  return viewer?.role ?? null;
}

interface ThemeDraftGradient {
  from?: string | null;
  to?: string | null;
}

type ThemeDraftBase = Omit<ThemePreferences, 'gradient'>;

interface ThemeDraftState extends ThemeDraftBase {
  gradient?: ThemeDraftGradient | null;
}

function normalizeDraft(theme: ThemeDraftState): ThemePreferences {
  const result: ThemePreferences = {};
  if (theme.mode) {
    result.mode = theme.mode;
  }
  if (theme.primary) {
    const hex = normalizeThemeHex(theme.primary);
    if (hex) result.primary = hex;
  }
  if (theme.accent) {
    const hex = normalizeThemeHex(theme.accent);
    if (hex) result.accent = hex;
  }
  if (theme.surface) {
    const hex = normalizeThemeHex(theme.surface);
    if (hex) result.surface = hex;
  }
  if (theme.gradient) {
    const from = theme.gradient.from ? normalizeThemeHex(theme.gradient.from) : null;
    const to = theme.gradient.to ? normalizeThemeHex(theme.gradient.to) : null;
    if (from && to) {
      result.gradient = { from, to };
    }
  }
  return result;
}

function applyThemePreview(layer: ThemeLayer, theme: ThemeDraftState) {
  const normalized = normalizeDraft(theme);
  if (Object.keys(normalized).length === 0) {
    clearThemeLayer(layer);
  } else {
    setThemeLayer(layer, normalized);
  }
}

function formatHexInput(value: string | null | undefined): string {
  const normalized = normalizeThemeHex(value);
  return normalized ?? '';
}

interface ThemeFieldProps {
  label: string;
  value: string | null | undefined;
  onChange: (hex: string | null) => void;
}

function ThemeColorField({ label, value, onChange }: ThemeFieldProps) {
  const displayValue = formatHexInput(value) || '#FFFFFF';

  const handleColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeThemeHex(event.target.value);
    if (normalized) {
      onChange(normalized);
    }
  };

  const handleTextBlur = (event: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeThemeHex(event.target.value);
    if (normalized) {
      onChange(normalized);
    }
  };

  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label={label}
          value={displayValue}
          onChange={handleColorChange}
          className="h-9 w-12 cursor-pointer rounded-md border border-subtle bg-transparent"
        />
        <Input defaultValue={displayValue} onBlur={handleTextBlur} className="w-full" placeholder="#FFFFFF" />
      </div>
    </label>
  );
}

function ThemePreview({ title }: { title: string }) {
  const active = getActiveTheme();
  const gradient = active.gradient ?? DEFAULT_THEME.gradient;
  const contrast = pickContrast(active.primary ?? DEFAULT_THEME.primary);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-subtle bg-surface-soft p-4">
      <div
        className="rounded-xl p-6 text-sm text-[var(--accent-on-primary)] shadow-soft"
        style={{
          backgroundImage: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
          color: contrast,
        }}
      >
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          Предпросмотр
        </span>
        <h4 className="mt-2 text-lg font-semibold">{title}</h4>
        <p className="text-xs opacity-80">Градиент и цвета обновляются при изменениях.</p>
      </div>
    </div>
  );
}

function ThemeForm({
  title,
  description,
  layer,
  presets,
  draft,
  setDraft,
  onSubmit,
  allowReset,
  isSaving,
  status,
  setStatus,
}: {
  title: string;
  description: string;
  layer: ThemeLayer;
  presets: ThemePreset[];
  draft: ThemeDraftState;
  setDraft: (draft: ThemeDraftState) => void;
  onSubmit: (theme: ThemePreferences | Record<string, never>, reset: boolean) => Promise<void>;
  allowReset: boolean;
  isSaving: boolean;
  status: SaveState;
  setStatus: (state: SaveState) => void;
}) {
  const handleModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = event.target.value as ThemeMode;
    const next = { ...draft, mode };
    setDraft(next);
    applyThemePreview(layer, next);
  };

  const handleFieldChange = (key: keyof ThemePreferences, value: string | null) => {
    const next = { ...draft } as ThemeDraftState;
    if (key === 'gradient') {
      // handled separately
      return;
    }
    (next as any)[key] = value;
    setDraft(next);
    applyThemePreview(layer, next);
  };

  const handleGradientChange = (part: 'from' | 'to', value: string | null) => {
    const next: ThemeDraftState = {
      ...draft,
      gradient: {
        ...(draft.gradient ?? {}),
        [part]: value,
      },
    };
    setDraft(next);
    applyThemePreview(layer, next);
  };

  const handlePreset = (preset: ThemePreset) => {
    const next: ThemeDraftState = {
      mode: preset.mode,
      primary: preset.primary ?? null,
      accent: preset.accent ?? null,
      surface: preset.surface ?? null,
      gradient: preset.gradient ? { ...preset.gradient } : null,
    };
    setDraft(next);
    applyThemePreview(layer, next);
    setStatus('idle');
  };

  const handleReset = () => {
    if (allowReset) {
      clearThemeLayer(layer);
      setDraft({});
      setStatus('idle');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('saving');
    const normalized = normalizeDraft(draft);
    const reset = Object.keys(normalized).length === 0;
    try {
      await onSubmit(reset ? {} : normalized, reset);
      setStatus('saved');
      if (reset) {
        clearThemeLayer(layer);
      } else {
        setThemeLayer(layer, normalized);
      }
      setTimeout(() => setStatus('idle'), 2500);
    } catch (error) {
      console.error('Failed to save theme', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <Card className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <ThemePreview title={title} />
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Режим
            <Select value={draft.mode ?? 'system'} onChange={handleModeChange}>
              {MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <ThemeColorField
            label="Основной цвет"
            value={draft.primary ?? null}
            onChange={(hex) => handleFieldChange('primary', hex)}
          />
          <ThemeColorField
            label="Акцент"
            value={draft.accent ?? null}
            onChange={(hex) => handleFieldChange('accent', hex)}
          />
          <ThemeColorField
            label="Поверхность карточек"
            value={draft.surface ?? null}
            onChange={(hex) => handleFieldChange('surface', hex)}
          />
          <ThemeColorField
            label="Градиент (от)"
            value={draft.gradient?.from ?? null}
            onChange={(hex) => handleGradientChange('from', hex)}
          />
          <ThemeColorField
            label="Градиент (до)"
            value={draft.gradient?.to ?? null}
            onChange={(hex) => handleGradientChange('to', hex)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-subtle px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted transition-base hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
              onClick={() => handlePreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Сохраняем…' : 'Сохранить'}
          </Button>
          {allowReset ? (
            <Button type="button" variant="ghost" onClick={handleReset} disabled={isSaving}>
              Сбросить
            </Button>
          ) : null}
          <StatusMessage status={status} success="Настройки сохранены" />
        </div>
      </form>
    </Card>
  );
}

function StatusMessage({ status, success }: { status: SaveState; success: string }) {
  if (status === 'saving') {
    return <span className="text-sm text-muted">Сохраняем…</span>;
  }
  if (status === 'saved') {
    return <span className="text-sm text-emerald-600">{success}</span>;
  }
  if (status === 'error') {
    return <span className="text-sm text-red-500">Не удалось сохранить</span>;
  }
  return null;
}

export default function SettingsModule() {
  const queryClient = useQueryClient();
  const viewerRole = useViewerRole();
  const isAdmin = viewerRole?.toLowerCase() === 'admin';

  const userSettingsQuery = useQuery({
    queryKey: ['settings', 'bundle'],
    queryFn: fetchUserSettingsBundle,
    staleTime: 30_000,
    gcTime: 120_000,
  });

  const globalThemeQuery = useQuery({
    queryKey: ['settings', 'global-theme'],
    queryFn: fetchGlobalTheme,
    enabled: isAdmin,
  });

  const adminSettingsQuery = useQuery({
    queryKey: ['settings', 'admin'],
    queryFn: fetchAdminSettings,
    enabled: isAdmin,
  });

  const [userThemeDraft, setUserThemeDraft] = useState<ThemeDraftState>({});
  const [userThemeStatus, setUserThemeStatus] = useState<SaveState>('idle');
  const [globalThemeDraft, setGlobalThemeDraft] = useState<ThemeDraftState>({});
  const [globalThemeStatus, setGlobalThemeStatus] = useState<SaveState>('idle');
  const [brandingStatus, setBrandingStatus] = useState<SaveState>('idle');
  const [telegramStatus, setTelegramStatus] = useState<SaveState>('idle');
  const [restartStatus, setRestartStatus] = useState<string | null>(null);
  const defaultBrowserTimezone = useMemo(() => {
    if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    return 'UTC';
  }, []);
  const [timezoneValue, setTimezoneValue] = useState<string>(defaultBrowserTimezone);
  const [timezoneStatus, setTimezoneStatus] = useState<SaveState>('idle');

  const timezoneSetting = userSettingsQuery.data?.timezone?.name ?? null;
  const timezoneVersion = userSettingsQuery.data?.timezone?.v ?? 1;

  useEffect(() => {
    if (timezoneSetting && timezoneSetting !== timezoneValue) {
      setTimezoneValue(timezoneSetting);
      return;
    }
    if (!timezoneSetting && userSettingsQuery.isSuccess && timezoneValue !== defaultBrowserTimezone) {
      setTimezoneValue(defaultBrowserTimezone);
    }
  }, [timezoneSetting, userSettingsQuery.isSuccess, defaultBrowserTimezone, timezoneValue]);

  const timezoneOptions = useMemo<string[]>(() => {
    const intlAny = Intl as unknown as { supportedValuesOf?: (input: string) => string[] };
    if (typeof Intl !== 'undefined' && typeof intlAny.supportedValuesOf === 'function') {
      try {
        return intlAny.supportedValuesOf('timeZone') || [];
      } catch (error) {
        console.warn('supportedValuesOf timeZone not available', error);
      }
    }
    return ['Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Asia/Almaty', 'UTC'];
  }, []);

  useEffect(() => {
    const userTheme = themeFromUserSettings(userSettingsQuery.data?.theme_preferences ?? {});
    setUserThemeDraft(userTheme);
    if (Object.keys(userTheme).length) {
      setThemeLayer('user', userTheme);
    } else {
      clearThemeLayer('user');
    }
  }, [userSettingsQuery.data?.theme_preferences]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    const entries = globalThemeQuery.data?.entries ?? {};
    const globalTheme = themeFromEntries(entries);
    setGlobalThemeDraft(globalTheme);
    if (Object.keys(globalTheme).length) {
      setThemeLayer('global', globalTheme);
    } else {
      clearThemeLayer('global');
    }
  }, [globalThemeQuery.data?.entries, isAdmin]);

  const timezoneMutation = useMutation({
    mutationFn: (name: string) => updateTimezoneSetting({ v: timezoneVersion > 0 ? timezoneVersion : 1, name }),
    onMutate: () => setTimezoneStatus('saving'),
    onSuccess: (_, name) => {
      setTimezoneStatus('saved');
      queryClient.setQueryData<UserSettingsBundle | undefined>(['settings', 'bundle'], (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          timezone: { v: timezoneVersion > 0 ? timezoneVersion : 1, name },
        };
      });
      setTimeout(() => setTimezoneStatus('idle'), 2000);
    },
    onError: (error: unknown) => {
      console.error('Failed to update timezone', error);
      setTimezoneStatus('error');
      setTimeout(() => setTimezoneStatus('idle'), 3000);
    },
  });

  const brandingMutation = useMutation({
    mutationFn: (payload: AdminBrandingSettings) => updateAdminBranding(payload),
    onMutate: () => setBrandingStatus('saving'),
    onSuccess: () => {
      setBrandingStatus('saved');
      setTimeout(() => setBrandingStatus('idle'), 2000);
    },
    onError: (error: unknown) => {
      console.error('Failed to update branding', error);
      setBrandingStatus('error');
      setTimeout(() => setBrandingStatus('idle'), 3000);
    },
  });

  const telegramMutation = useMutation({
    mutationFn: (payload: AdminTelegramSettings) => updateAdminTelegram(payload),
    onMutate: () => setTelegramStatus('saving'),
    onSuccess: () => {
      setTelegramStatus('saved');
      setTelegramForm((prev) => (prev ? { ...prev, TG_BOT_TOKEN: '' } : prev));
      setTimeout(() => setTelegramStatus('idle'), 2000);
    },
    onError: (error: unknown) => {
      console.error('Failed to update telegram settings', error);
      setTelegramStatus('error');
      setTimeout(() => setTelegramStatus('idle'), 3000);
    },
  });

  const handleTimezoneSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!timezoneValue) {
      return;
    }
    timezoneMutation.mutate(timezoneValue);
  };

  const handleUserThemeSubmit = async (theme: ThemePreferences | Record<string, never>, reset: boolean) => {
    await updateThemePreferences(theme);
    if (reset) {
      clearThemeLayer('user');
    }
  };

  const handleGlobalThemeSubmit = async (theme: ThemePreferences | Record<string, never>, reset: boolean) => {
    if (reset) {
      await resetGlobalTheme();
      clearThemeLayer('global');
    } else {
      const entries = entriesFromTheme(theme);
      await updateGlobalThemeEntries(entries);
      setThemeLayer('global', theme);
    }
  };

  const adminBranding = adminSettingsQuery.data?.branding;
  const adminTelegram = adminSettingsQuery.data?.telegram;

  const [brandingForm, setBrandingForm] = useState<AdminBrandingSettings | null>(null);
  const [telegramForm, setTelegramForm] = useState<AdminTelegramSettings | null>(null);

  useEffect(() => {
    if (adminBranding) {
      setBrandingForm(adminBranding);
    }
  }, [adminBranding?.BRAND_NAME, adminBranding?.PUBLIC_URL, adminBranding?.BOT_LANDING_URL]);

  useEffect(() => {
    if (adminTelegram) {
      setTelegramForm({
        TG_LOGIN_ENABLED: adminTelegram.TG_LOGIN_ENABLED,
        TG_BOT_USERNAME: adminTelegram.TG_BOT_USERNAME,
        TG_BOT_TOKEN: null,
      });
    }
  }, [adminTelegram?.TG_BOT_USERNAME, adminTelegram?.TG_LOGIN_ENABLED]);

  const handleBrandingSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!brandingForm) {
      return;
    }
    brandingMutation.mutate(brandingForm);
  };

  const handleTelegramSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!telegramForm) {
      return;
    }
    telegramMutation.mutate(telegramForm);
  };

  const handleRestart = async (target: 'web' | 'bot') => {
    setRestartStatus('Ожидайте…');
    try {
      const result = await restartService(target);
      if (result.ok) {
        setRestartStatus(`Рестарт ${target} инициирован`);
      } else {
        setRestartStatus(result.message ?? 'Ошибка перезапуска');
      }
    } catch (error) {
      console.error('Failed to restart service', error);
      setRestartStatus('Ошибка перезапуска');
    }
    setTimeout(() => setRestartStatus(null), 4000);
  };

  const isLoading = userSettingsQuery.isLoading || (isAdmin && adminSettingsQuery.isLoading);

  return (
    <div className="flex flex-col gap-12">
      {isLoading ? <span className="text-sm text-muted">Загружаем настройки…</span> : null}

      <Card className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Изменение тарифов
            </span>
            <h2 className="text-lg font-semibold text-amber-900">Скоро повышаем стоимость подписки</h2>
            <p className="text-sm text-amber-800">
              Проверьте обновлённые цены и зафиксируйте текущий план до обновления.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://intdata.pro/tariffs"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-base hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-100"
            target="_blank"
            rel="noreferrer"
          >
            Посмотреть обновления тарифов
          </a>
          <span className="text-xs text-amber-700">
            Solo-план остаётся бесплатным
          </span>
        </div>
      </Card>

      <Section spacing="lg" className="gap-6">
        <header className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Региональные настройки</h2>
          <p className="text-sm text-muted">Часовой пояс влияет на тайм-трекинг, уведомления и расписание.</p>
        </header>
        <Card as="section" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Часовой пояс</h3>
            <p className="text-sm text-muted">Определяет отображение времени и даты во всех модулях.</p>
          </div>
          <form className="flex flex-col gap-4" onSubmit={handleTimezoneSubmit}>
            <Select
              value={timezoneValue}
              onChange={(event) => setTimezoneValue(event.target.value)}
              disabled={timezoneMutation.isPending}
            >
              {timezoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={timezoneMutation.isPending}>
                {timezoneMutation.isPending ? 'Сохраняем…' : 'Сохранить'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTimezoneValue(defaultBrowserTimezone)}
                disabled={timezoneMutation.isPending}
              >
                Автоопределение
              </Button>
              <StatusMessage status={timezoneStatus} success="Часовой пояс обновлён" />
            </div>
          </form>
        </Card>
      </Section>


      <Section spacing="lg" className="gap-6" id="areas">
        <header className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Области жизни (PARA)</h2>
          <p className="text-sm text-muted">
            Управляйте деревом областей: проекты и задачи наследуют выбранные контейнеры автоматически.
          </p>
        </header>
        <Card className="p-6">
          <AreasManager variant="settings" />
        </Card>
      </Section>

      <Section spacing="lg" className="gap-6">
        <header className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Тема интерфейса</h2>
          <p className="text-sm text-muted">
            Настройте личный пресет или обновите корпоративные цвета. Мы автоматически подбираем контрастность.
          </p>
        </header>
        <ThemeForm
          title="Личный пресет"
          description="Работает только для вашего аккаунта. Можно быстро сменить оформление или вернуться к корпоративным настройкам."
          layer="user"
          presets={THEME_PRESETS}
          draft={userThemeDraft}
          setDraft={setUserThemeDraft}
          onSubmit={handleUserThemeSubmit}
          allowReset
          isSaving={userThemeStatus === 'saving'}
          status={userThemeStatus}
          setStatus={setUserThemeStatus}
        />
        {isAdmin ? (
          <ThemeForm
            title="Глобальная тема"
            description="Влияет на всех пользователей. При сбросе вернёмся к дефолтным значениям."
            layer="global"
            presets={THEME_PRESETS}
            draft={globalThemeDraft}
            setDraft={setGlobalThemeDraft}
            onSubmit={handleGlobalThemeSubmit}
            allowReset
            isSaving={globalThemeStatus === 'saving'}
            status={globalThemeStatus}
            setStatus={setGlobalThemeStatus}
          />
        ) : null}
      </Section>

      {isAdmin ? (
        <Section spacing="lg" className="gap-6">
          <header className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Административные настройки</h2>
            <p className="text-sm text-muted">Видны только администраторам и влияют на всю рабочую область.</p>
          </header>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card as="section" className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Брендинг</h3>
                <p className="text-sm text-muted">Обновите название и публичные ссылки продукта.</p>
              </div>
              <form className="flex flex-col gap-4" onSubmit={handleBrandingSubmit}>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Имя бренда
                  <Input
                    value={brandingForm?.BRAND_NAME ?? ''}
                    onChange={(event) =>
                      setBrandingForm((prev) => ({
                        ...(prev ?? { PUBLIC_URL: '', BOT_LANDING_URL: '', BRAND_NAME: '' }),
                        BRAND_NAME: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Публичный URL
                  <Input
                    type="url"
                    value={brandingForm?.PUBLIC_URL ?? ''}
                    onChange={(event) =>
                      setBrandingForm((prev) => ({
                        ...(prev ?? { PUBLIC_URL: '', BOT_LANDING_URL: '', BRAND_NAME: '' }),
                        PUBLIC_URL: event.target.value,
                      }))
                    }
                    placeholder="https://intdata.pro"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  URL бота
                  <Input
                    type="url"
                    value={brandingForm?.BOT_LANDING_URL ?? ''}
                    onChange={(event) =>
                      setBrandingForm((prev) => ({
                        ...(prev ?? { PUBLIC_URL: '', BOT_LANDING_URL: '', BRAND_NAME: '' }),
                        BOT_LANDING_URL: event.target.value,
                      }))
                    }
                    placeholder="https://intdata.pro/bot"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={brandingMutation.isPending}>
                    {brandingMutation.isPending ? 'Сохраняем…' : 'Сохранить'}
                  </Button>
                  <StatusMessage status={brandingStatus} success="Брендинг обновлён" />
                </div>
              </form>
            </Card>

            <Card as="section" className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Telegram интеграции</h3>
                <p className="text-sm text-muted">Управляйте входом и токеном бота без перезапуска.</p>
              </div>
              <form className="flex flex-col gap-4" onSubmit={handleTelegramSubmit}>
                <label className="flex items-center gap-3 text-sm text-[var(--text-primary)]">
                  <Checkbox
                    checked={telegramForm?.TG_LOGIN_ENABLED ?? false}
                    onChange={(event) =>
                      setTelegramForm((prev) => ({
                        ...(prev ?? { TG_LOGIN_ENABLED: false, TG_BOT_USERNAME: null, TG_BOT_TOKEN: null }),
                        TG_LOGIN_ENABLED: event.target.checked,
                      }))
                    }
                  />
                  <span>Включить Telegram Login</span>
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Имя бота (без @)
                  <Input
                    value={telegramForm?.TG_BOT_USERNAME ?? ''}
                    onChange={(event) =>
                      setTelegramForm((prev) => ({
                        ...(prev ?? { TG_LOGIN_ENABLED: false, TG_BOT_USERNAME: null, TG_BOT_TOKEN: null }),
                        TG_BOT_USERNAME: event.target.value,
                      }))
                    }
                    placeholder="intDataBot"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Новый токен бота
                  <Input
                    type="password"
                    value={telegramForm?.TG_BOT_TOKEN ?? ''}
                    onChange={(event) =>
                      setTelegramForm((prev) => ({
                        ...(prev ?? { TG_LOGIN_ENABLED: false, TG_BOT_USERNAME: null, TG_BOT_TOKEN: null }),
                        TG_BOT_TOKEN: event.target.value,
                      }))
                    }
                    placeholder="Оставьте пустым, если без изменений"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={telegramMutation.isPending}>
                    {telegramMutation.isPending ? 'Сохраняем…' : 'Сохранить'}
                  </Button>
                  <StatusMessage status={telegramStatus} success="Настройки сохранены" />
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted">
                  <Button type="button" variant="secondary" onClick={() => handleRestart('web')}>
                    Рестарт веба
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => handleRestart('bot')}>
                    Рестарт бота
                  </Button>
                  {restartStatus ? <span className="basis-full text-xs text-muted">{restartStatus}</span> : null}
                </div>
              </form>
            </Card>
          </div>
          <Card className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Заготовки будущих настроек</h3>
            <p className="text-sm text-muted">
              Используйте карточку как шаблон при расширении административного раздела.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-dashed border-subtle bg-surface-soft p-4">
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Пресеты уведомлений</h4>
                <p className="text-xs text-muted">Добавьте переключатели и селекты для настройки частоты уведомлений.</p>
              </div>
              <div className="rounded-xl border border-dashed border-subtle bg-surface-soft p-4">
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Интеграции</h4>
                <p className="text-xs text-muted">Карточка с toggles, списком вебхуков и CTA «Добавить интеграцию».</p>
              </div>
            </div>
          </Card>
        </Section>
      ) : null}
    </div>
  );
}
