export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeGradient {
  from: string;
  to: string;
}

export interface ThemeSettings {
  mode?: ThemeMode;
  primary?: string | null;
  accent?: string | null;
  surface?: string | null;
  gradient?: ThemeGradient | null;
}

export interface AppliedTheme extends ThemeSettings {
  mode: ThemeMode;
  primary: string;
  accent: string;
  surface: string;
  gradient: ThemeGradient;
}

type ThemeLayer = 'global' | 'user';

export const DEFAULT_THEME: AppliedTheme = {
  mode: 'system',
  primary: '#64C6A9',
  accent: '#CFA0E9',
  surface: '#FFFFFF',
  gradient: { from: '#6366F1', to: '#8B5CF6' },
};

const layers: Record<ThemeLayer, ThemeSettings> = {
  global: {},
  user: {},
};

const watchers: Array<(theme: AppliedTheme) => void> = [];
let activeTheme: AppliedTheme = { ...DEFAULT_THEME };

function normalizeHex(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  let hex = value.trim();
  if (!hex) {
    return null;
  }
  if (!hex.startsWith('#')) {
    hex = `#${hex}`;
  }
  if (hex.length === 4) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return /^#([0-9a-f]{6})$/i.test(hex) ? hex.toUpperCase() : null;
}

export function normalizeThemeHex(value?: string | null): string | null {
  return normalizeHex(value);
}

function contrastColor(hex: string): string {
  const value = normalizeHex(hex) ?? '#000000';
  const r = parseInt(value.slice(1, 3), 16) / 255;
  const g = parseInt(value.slice(3, 5), 16) / 255;
  const b = parseInt(value.slice(5, 7), 16) / 255;
  const srgb = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const luminance = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return luminance > 0.53 ? '#111111' : '#FFFFFF';
}

function mix(hex: string, percent: number): string {
  const base = normalizeHex(hex) ?? '#000000';
  const r = parseInt(base.substring(1, 3), 16);
  const g = parseInt(base.substring(3, 5), 16);
  const b = parseInt(base.substring(5, 7), 16);
  const target = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  const blend = (channel: number) => Math.round((target - channel) * p + channel);
  const toHex = (num: number) => num.toString(16).padStart(2, '0');
  return `#${toHex(blend(r))}${toHex(blend(g))}${toHex(blend(b))}`.toUpperCase();
}

function normalizeGradient(gradient?: ThemeGradient | null): ThemeGradient | null {
  if (!gradient) {
    return null;
  }
  const from = normalizeHex(gradient.from);
  const to = normalizeHex(gradient.to);
  if (!from || !to) {
    return null;
  }
  return { from, to };
}

function normalizeTheme(theme?: ThemeSettings | null): ThemeSettings {
  if (!theme || typeof theme !== 'object') {
    return {};
  }
  const normalized: ThemeSettings = {};
  if (theme.mode && ['light', 'dark', 'system'].includes(theme.mode)) {
    normalized.mode = theme.mode;
  }
  const primary = normalizeHex(theme.primary ?? undefined);
  if (primary) {
    normalized.primary = primary;
  }
  const accent = normalizeHex(theme.accent ?? undefined);
  if (accent) {
    normalized.accent = accent;
  }
  const surface = normalizeHex(theme.surface ?? undefined);
  if (surface) {
    normalized.surface = surface;
  }
  const gradient = normalizeGradient(theme.gradient ?? null);
  if (gradient) {
    normalized.gradient = gradient;
  }
  return normalized;
}

function resolveMode(theme: ThemeSettings | AppliedTheme): ThemeMode {
  const mode = theme.mode ?? DEFAULT_THEME.mode;
  if (mode === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return DEFAULT_THEME.mode;
  }
  return mode;
}

function resolvePrimary(theme: ThemeSettings | AppliedTheme): string {
  return normalizeHex(theme.primary) ?? DEFAULT_THEME.primary;
}

function resolveAccent(theme: ThemeSettings | AppliedTheme): string {
  return normalizeHex(theme.accent) ?? DEFAULT_THEME.accent;
}

function resolveSurface(theme: ThemeSettings | AppliedTheme): string {
  return normalizeHex(theme.surface) ?? DEFAULT_THEME.surface;
}

function resolveGradient(theme: ThemeSettings | AppliedTheme): ThemeGradient {
  const gradient = normalizeGradient(theme.gradient);
  return gradient ?? DEFAULT_THEME.gradient;
}

function applyCss(theme: AppliedTheme): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.dataset.themeMode = theme.mode;
  root.style.setProperty('--theme-primary', theme.primary);
  root.style.setProperty('--theme-primary-contrast', pickContrast(theme.primary));
  root.style.setProperty('--theme-primary-soft', mix(theme.primary, 0.9));
  root.style.setProperty('--theme-primary-soft-contrast', pickContrast(mix(theme.primary, 0.9)));
  root.style.setProperty('--theme-accent', theme.accent);
  root.style.setProperty('--theme-accent-contrast', pickContrast(theme.accent));
  root.style.setProperty('--theme-surface', theme.surface);
  root.style.setProperty('--theme-surface-contrast', pickContrast(theme.surface));
  root.style.setProperty('--theme-gradient-from', theme.gradient.from);
  root.style.setProperty('--theme-gradient-to', theme.gradient.to);
}

function mergeThemes(): AppliedTheme {
  const ordered: ThemeLayer[] = ['global', 'user'];
  let merged: AppliedTheme = {
    mode: DEFAULT_THEME.mode,
    primary: DEFAULT_THEME.primary,
    accent: DEFAULT_THEME.accent,
    surface: DEFAULT_THEME.surface,
    gradient: DEFAULT_THEME.gradient,
  };
  for (const layer of ordered) {
    const theme = layers[layer];
    if (!theme) {
      continue;
    }
    if (theme.mode) {
      merged.mode = theme.mode;
    }
    if (theme.primary) {
      merged.primary = theme.primary;
    }
    if (theme.accent) {
      merged.accent = theme.accent;
    }
    if (theme.surface) {
      merged.surface = theme.surface;
    }
    if (theme.gradient) {
      merged.gradient = theme.gradient;
    }
  }
  merged = {
    mode: resolveMode(merged),
    primary: resolvePrimary(merged),
    accent: resolveAccent(merged),
    surface: resolveSurface(merged),
    gradient: resolveGradient(merged),
  };
  return merged;
}

function applyLayers(): void {
  activeTheme = mergeThemes();
  applyCss(activeTheme);
  watchers.forEach((watch) => {
    try {
      watch(activeTheme);
    } catch (error) {
      console.error('Theme watcher failed', error);
    }
  });
}

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => applyLayers();
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', listener);
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(listener);
  }
}

export function setThemeLayer(layer: ThemeLayer, theme?: ThemeSettings | null): void {
  layers[layer] = normalizeTheme(theme);
  applyLayers();
}

export function clearThemeLayer(layer: ThemeLayer): void {
  layers[layer] = {};
  applyLayers();
}

export function getActiveTheme(): AppliedTheme {
  return activeTheme;
}

export function onThemeChange(handler: (theme: AppliedTheme) => void): () => void {
  watchers.push(handler);
  return () => {
    const index = watchers.indexOf(handler);
    if (index >= 0) {
      watchers.splice(index, 1);
    }
  };
}

export function themeFromUserSettings(value: unknown): ThemeSettings {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return normalizeTheme(value as ThemeSettings);
}

export function themeFromEntries(entries: Record<string, unknown>): ThemeSettings {
  const theme: ThemeSettings = {};
  const mode = entries['theme.global.mode'];
  const primary = entries['theme.global.primary'];
  const accent = entries['theme.global.accent'];
  const surface = entries['theme.global.surface'];
  const gradientFrom = entries['theme.global.gradient.from'];
  const gradientTo = entries['theme.global.gradient.to'];
  if (typeof mode === 'string') {
    theme.mode = mode as ThemeMode;
  }
  if (typeof primary === 'string') {
    theme.primary = primary;
  }
  if (typeof accent === 'string') {
    theme.accent = accent;
  }
  if (typeof surface === 'string') {
    theme.surface = surface;
  }
  if (typeof gradientFrom === 'string' && typeof gradientTo === 'string') {
    theme.gradient = { from: gradientFrom, to: gradientTo };
  }
  return normalizeTheme(theme);
}

export function entriesFromTheme(theme: ThemeSettings): Record<string, string> {
  const normalized = normalizeTheme(theme);
  const entries: Record<string, string> = {};
  if (normalized.mode) {
    entries['theme.global.mode'] = normalized.mode;
  }
  if (normalized.primary) {
    entries['theme.global.primary'] = normalized.primary;
  }
  if (normalized.accent) {
    entries['theme.global.accent'] = normalized.accent;
  }
  if (normalized.surface) {
    entries['theme.global.surface'] = normalized.surface;
  }
  if (normalized.gradient) {
    entries['theme.global.gradient.from'] = normalized.gradient.from;
    entries['theme.global.gradient.to'] = normalized.gradient.to;
  }
  return entries;
}

export function pickContrast(hex: string): string {
  return contrastColor(hex);
}

// Initialize layers once module is loaded in the browser
applyLayers();
