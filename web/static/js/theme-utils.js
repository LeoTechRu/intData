const DEFAULT_THEME = {
  mode: 'system',
  primary: '#64C6A9',
  accent: '#CFA0E9',
  surface: '#FFFFFF',
  gradient: { from: '#6366F1', to: '#8B5CF6' },
};

const layers = {
  global: {},
  user: {},
};

const watchers = [];

function normalizeHex(value) {
  if (!value) return null;
  let hex = value.toString().trim();
  if (!hex) return null;
  if (hex.startsWith('var')) return null;
  if (!hex.startsWith('#')) hex = `#${hex}`;
  if (hex.length === 4) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return /^#([0-9a-f]{6})$/i.test(hex) ? hex.toUpperCase() : null;
}

function contrastColor(hex) {
  const value = normalizeHex(hex) || '#000000';
  const r = parseInt(value.slice(1, 3), 16) / 255;
  const g = parseInt(value.slice(3, 5), 16) / 255;
  const b = parseInt(value.slice(5, 7), 16) / 255;
  const srgb = [r, g, b].map((c) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return luminance > 0.53 ? '#111111' : '#FFFFFF';
}

function mix(hex, percent) {
  const base = normalizeHex(hex) || '#000000';
  const r = parseInt(base.substr(1, 2), 16);
  const g = parseInt(base.substr(3, 2), 16);
  const b = parseInt(base.substr(5, 2), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  const blend = (channel) => Math.round((t - channel) * p + channel);
  const toHex = (num) => num.toString(16).padStart(2, '0');
  return `#${toHex(blend(r))}${toHex(blend(g))}${toHex(blend(b))}`.toUpperCase();
}

function normalizeGradient(gradient) {
  if (!gradient) return undefined;
  const from = normalizeHex(gradient.from);
  const to = normalizeHex(gradient.to);
  if (!from || !to) return undefined;
  return { from, to };
}

function normalizeTheme(theme) {
  if (!theme || typeof theme !== 'object') return {};
  const normalized = {};
  if (theme.mode && ['light', 'dark', 'system'].includes(theme.mode)) {
    normalized.mode = theme.mode;
  }
  if (theme.primary) normalized.primary = normalizeHex(theme.primary);
  if (theme.accent) normalized.accent = normalizeHex(theme.accent);
  if (theme.surface) normalized.surface = normalizeHex(theme.surface);
  const gradient = normalizeGradient(theme.gradient);
  if (gradient) normalized.gradient = gradient;
  return normalized;
}

function resolveMode(theme) {
  const mode = theme.mode || DEFAULT_THEME.mode;
  if (mode === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return mode;
}

function applyCss(theme) {
  const root = document.documentElement;
  const mode = resolveMode(theme);
  root.dataset.theme = mode;
  const primary = normalizeHex(theme.primary) || DEFAULT_THEME.primary;
  const accent = normalizeHex(theme.accent) || DEFAULT_THEME.accent;
  const surface = normalizeHex(theme.surface) || (mode === 'dark' ? '#1F2937' : '#FFFFFF');
  const background = mode === 'dark' ? '#0B1120' : '#FFFFFF';
  const text = mode === 'dark' ? '#F8FAFC' : '#1F2937';
  const muted = mode === 'dark' ? mix(text, -0.6) : mix(text, 0.6);
  const border = mode === 'dark' ? mix(surface, -0.35) : mix(surface, -0.15);
  root.style.setProperty('--color-primary', primary);
  root.style.setProperty('--color-primary-contrast', contrastColor(primary));
  root.style.setProperty('--color-accent', accent);
  root.style.setProperty('--color-accent-contrast', contrastColor(accent));
  root.style.setProperty('--color-surface', surface);
  root.style.setProperty('--color-surface-contrast', contrastColor(surface));
  root.style.setProperty('--color-bg', background);
  root.style.setProperty('--color-text', text);
  root.style.setProperty('--color-muted', muted);
  root.style.setProperty('--color-border', border);
  const gradient = theme.gradient || DEFAULT_THEME.gradient;
  const gradientCss = gradient && gradient.from && gradient.to
    ? `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`
    : `linear-gradient(135deg, ${primary}, ${mix(primary, -0.25)})`;
  root.style.setProperty('--gradient-accent', gradientCss);
}

function mergeThemes() {
  const merged = { ...DEFAULT_THEME };
  for (const layer of ['global', 'user']) {
    const theme = layers[layer];
    if (!theme) continue;
    if (theme.mode) merged.mode = theme.mode;
    if (theme.primary) merged.primary = theme.primary;
    if (theme.accent) merged.accent = theme.accent;
    if (theme.surface) merged.surface = theme.surface;
    if (theme.gradient) merged.gradient = theme.gradient;
  }
  return merged;
}

function applyLayers() {
  const theme = mergeThemes();
  applyCss(theme);
  watchers.forEach((cb) => cb(theme));
}

function handleSystemChange() {
  applyLayers();
}

if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) {
    mq.addEventListener('change', handleSystemChange);
  } else if (mq.addListener) {
    mq.addListener(handleSystemChange);
  }
}

export function setThemeLayer(layer, theme) {
  if (!['global', 'user'].includes(layer)) return;
  layers[layer] = normalizeTheme(theme);
  applyLayers();
}

export function clearThemeLayer(layer) {
  if (!['global', 'user'].includes(layer)) return;
  layers[layer] = {};
  applyLayers();
}

export function onThemeChange(cb) {
  if (typeof cb === 'function') watchers.push(cb);
}

export function themeFromUserSettings(value) {
  if (!value || typeof value !== 'object') return {};
  return normalizeTheme(value);
}

export function themeFromEntries(entries) {
  if (!entries || typeof entries !== 'object') return {};
  const theme = {};
  if (entries['theme.global.mode']) theme.mode = entries['theme.global.mode'];
  if (entries['theme.global.primary']) theme.primary = entries['theme.global.primary'];
  if (entries['theme.global.accent']) theme.accent = entries['theme.global.accent'];
  if (entries['theme.global.surface']) theme.surface = entries['theme.global.surface'];
  const gradientFrom = entries['theme.global.gradient.from'];
  const gradientTo = entries['theme.global.gradient.to'];
  if (gradientFrom && gradientTo) {
    theme.gradient = { from: gradientFrom, to: gradientTo };
  }
  return normalizeTheme(theme);
}

export function entriesFromTheme(theme) {
  const normalized = normalizeTheme(theme);
  const entries = {};
  if (normalized.mode) entries['theme.global.mode'] = normalized.mode;
  if (normalized.primary) entries['theme.global.primary'] = normalized.primary;
  if (normalized.accent) entries['theme.global.accent'] = normalized.accent;
  if (normalized.surface) entries['theme.global.surface'] = normalized.surface;
  if (normalized.gradient) {
    entries['theme.global.gradient.from'] = normalized.gradient.from;
    entries['theme.global.gradient.to'] = normalized.gradient.to;
  }
  return entries;
}

export function getActiveTheme() {
  return mergeThemes();
}

export { DEFAULT_THEME };
export function pickContrast(hex) {
  return contrastColor(hex);
}
