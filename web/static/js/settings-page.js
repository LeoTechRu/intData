import { API_BASE } from './services/apiBase.js';
import {
  setThemeLayer,
  clearThemeLayer,
  themeFromUserSettings,
  themeFromEntries,
  entriesFromTheme,
  getActiveTheme,
  DEFAULT_THEME,
  pickContrast,
} from './theme-utils.js';

const root = document.querySelector('[data-settings-root]');

if (root) {
  const isAdmin = root.dataset.isAdmin === 'true';
  const state = {
    layout: { v: 1, layouts: {}, widgets: [], hidden: [] },
    favorites: { v: 1, items: [] },
    themeUserSaved: {},
    themeUserDraft: {},
    themeGlobalSaved: {},
    themeGlobalDraft: {},
  };

  const forms = {
    dashboard: document.getElementById('dashboard-settings-form'),
    favorites: document.getElementById('favorites-settings-form'),
    userTheme: document.getElementById('user-theme-form'),
    globalTheme: document.getElementById('global-theme-form'),
    branding: document.getElementById('branding-form'),
    telegram: document.getElementById('telegram-form'),
  };

  function feedback(container, message, type = 'success') {
    if (!container) return;
    let region = container.querySelector('.settings-feedback');
    if (!region) {
      region = document.createElement('div');
      region.className = 'settings-feedback';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      container.appendChild(region);
    }
    region.textContent = message;
    region.dataset.type = type;
    window.clearTimeout(region._timer); // eslint-disable-line no-underscore-dangle
    region._timer = window.setTimeout(() => {
      if (region && region.textContent === message) {
        region.textContent = '';
      }
    }, 4000);
  }

  function parseSettingsResponse(data) {
    state.favorites = data.favorites || { v: 1, items: [] };
    state.layout = data.dashboard_layout || state.layout;
    state.themeUserSaved = themeFromUserSettings(data.theme_preferences);
    state.themeUserDraft = { ...state.themeUserSaved };
  }

  async function fetchUserSettings() {
    try {
      const resp = await fetch(`${API_BASE}/user/settings?keys=dashboard_layout,favorites,theme_preferences`, { credentials: 'include' });
      if (!resp.ok) return;
      const data = await resp.json();
      parseSettingsResponse(data);
    } catch (err) {
      // ignore
    }
  }

  async function fetchGlobalTheme() {
    if (!isAdmin) return;
    try {
      const resp = await fetch(`${API_BASE}/app-settings?prefix=theme.global.`, { credentials: 'include' });
      if (!resp.ok) return;
      const data = await resp.json();
      state.themeGlobalSaved = themeFromEntries(data.entries || {});
      state.themeGlobalDraft = { ...state.themeGlobalSaved };
    } catch (err) {
      // ignore
    }
  }

  function applyLayoutForm() {
    if (!forms.dashboard) return;
    const selected = Array.isArray(state.layout.widgets) && state.layout.widgets.length
      ? new Set(state.layout.widgets)
      : null;
    forms.dashboard.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = !selected || selected.has(input.name);
    });
  }

  function applyFavoritesForm() {
    if (!forms.favorites) return;
    const items = state.favorites.items || [];
    const selected = items.length ? new Set(items.map((it) => it.path)) : null;
    forms.favorites.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = !selected || selected.has(input.name);
    });
  }

  function normalizeColorInput(value) {
    if (!value) return null;
    let v = value.trim();
    if (!v) return null;
    if (!v.startsWith('#')) v = `#${v}`;
    if (v.length === 4) {
      v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    }
    return /^#([0-9a-f]{6})$/i.test(v) ? v.toUpperCase() : null;
  }

  function getDraftTheme(layer) {
    return layer === 'global' ? state.themeGlobalDraft : state.themeUserDraft;
  }

  function setDraftTheme(layer, theme) {
    if (layer === 'global') {
      state.themeGlobalDraft = { ...theme };
    } else {
      state.themeUserDraft = { ...theme };
    }
  }

  function getSavedTheme(layer) {
    return layer === 'global' ? state.themeGlobalSaved : state.themeUserSaved;
  }

  function updateThemePreview(form, theme) {
    if (!form) return;
    const preview = form.querySelector('[data-theme-preview]');
    const gradientEl = form.querySelector('[data-theme-gradient]');
    if (!preview || !gradientEl) return;
    const primary = theme.primary || DEFAULT_THEME.primary;
    const accent = theme.accent || DEFAULT_THEME.accent;
    const gradientFrom = (theme.gradient && theme.gradient.from) || primary;
    const gradientTo = (theme.gradient && theme.gradient.to) || accent;
    gradientEl.style.backgroundImage = `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`;
    preview.style.setProperty('--preview-primary', primary);
    preview.style.setProperty('--preview-accent', accent);
    preview.style.setProperty('--preview-contrast', pickContrast(primary));
  }

  function populateThemeForm(form, theme, layer) {
    if (!form) return;
    const active = { ...getActiveTheme(), ...theme };
    const select = form.querySelector('select[data-theme-field]');
    if (select) {
      select.value = active.mode || 'system';
    }
    const map = {
      primary: active.primary || DEFAULT_THEME.primary,
      accent: active.accent || DEFAULT_THEME.accent,
      surface: active.surface || DEFAULT_THEME.surface,
      gradient_from: (active.gradient && active.gradient.from) || DEFAULT_THEME.gradient.from,
      gradient_to: (active.gradient && active.gradient.to) || DEFAULT_THEME.gradient.to,
    };
    Object.entries(map).forEach(([field, value]) => {
      const wrapper = form.querySelector(`[data-color-field="${field}"]`);
      if (!wrapper) return;
      const colorInput = wrapper.querySelector('input[type="color"]');
      const textInput = wrapper.querySelector('input[type="text"]');
      if (colorInput) colorInput.value = value;
      if (textInput) textInput.value = value.toUpperCase();
    });
    updateThemePreview(form, active);
    setDraftTheme(layer, { ...theme });
  }

  function readThemeFromForm(form) {
    if (!form) return {};
    const theme = {};
    const select = form.querySelector('select[data-theme-field]');
    if (select && ['light', 'dark', 'system'].includes(select.value)) {
      theme.mode = select.value;
    }
    form.querySelectorAll('[data-color-field]').forEach((wrapper) => {
      const key = wrapper.getAttribute('data-color-field');
      const colorInput = wrapper.querySelector('input[type="color"]');
      const textInput = wrapper.querySelector('input[type="text"]');
      const raw = textInput && textInput.value ? textInput.value : colorInput?.value;
      const value = normalizeColorInput(raw || '');
      if (!value) return;
      if (key === 'primary') theme.primary = value;
      if (key === 'accent') theme.accent = value;
      if (key === 'surface') theme.surface = value;
      if (key === 'gradient_from') {
        theme.gradient = theme.gradient || {};
        theme.gradient.from = value;
      }
      if (key === 'gradient_to') {
        theme.gradient = theme.gradient || {};
        theme.gradient.to = value;
      }
    });
    if (theme.gradient && (!theme.gradient.from || !theme.gradient.to)) {
      delete theme.gradient;
    }
    return theme;
  }

  function bindColorControls(form, layer) {
    form.querySelectorAll('[data-color-field]').forEach((wrapper) => {
      const colorInput = wrapper.querySelector('input[type="color"]');
      const textInput = wrapper.querySelector('input[type="text"]');
      const sync = (value) => {
        if (colorInput) colorInput.value = value;
        if (textInput) textInput.value = value.toUpperCase();
      };
      if (colorInput) {
        colorInput.addEventListener('input', (event) => {
          const value = normalizeColorInput(event.target.value);
          if (!value) return;
          if (textInput) textInput.value = value;
          const theme = readThemeFromForm(form);
          setDraftTheme(layer, theme);
          setThemeLayer(layer, theme);
          updateThemePreview(form, { ...getActiveTheme(), ...theme });
        });
      }
      if (textInput) {
        textInput.addEventListener('change', (event) => {
          const value = normalizeColorInput(event.target.value);
          if (value) {
            sync(value);
            const theme = readThemeFromForm(form);
            setDraftTheme(layer, theme);
            setThemeLayer(layer, theme);
            updateThemePreview(form, { ...getActiveTheme(), ...theme });
          } else if (colorInput) {
            sync(colorInput.value);
          }
        });
      }
    });
  }

  function bindThemePresets(form, layer) {
    const area = form.querySelector('[data-theme-presets]');
    if (!area) return;
   area.addEventListener('click', (event) => {
     const btn = event.target.closest('[data-theme-preset]');
     if (!btn) return;
     event.preventDefault();
     try {
       const preset = JSON.parse(btn.dataset.themePreset || '{}');
       if (Object.keys(preset).length === 0) return;
       setDraftTheme(layer, preset);
       populateThemeForm(form, preset, layer);
       setThemeLayer(layer, preset);
        delete form.dataset.reset;
     } catch (err) {
        // ignore malformed preset payloads
     }
   });
  }

  function bindThemeForm(form, layer) {
    const saved = getSavedTheme(layer);
    const initial = Object.keys(saved).length ? saved : getActiveTheme();
    populateThemeForm(form, initial, layer);
    bindColorControls(form, layer);
    bindThemePresets(form, layer);
    const select = form.querySelector('select[data-theme-field]');
   if (select) {
     select.addEventListener('change', () => {
       const theme = readThemeFromForm(form);
       setDraftTheme(layer, theme);
       setThemeLayer(layer, theme);
       updateThemePreview(form, { ...getActiveTheme(), ...theme });
        delete form.dataset.reset;
     });
    }
    const reset = form.querySelector('[data-theme-reset]');
    if (reset) {
      reset.addEventListener('click', (event) => {
        event.preventDefault();
        if (layer === 'global') {
          state.themeGlobalDraft = {};
          state.themeGlobalSaved = {};
          clearThemeLayer('global');
          populateThemeForm(form, DEFAULT_THEME, layer);
          feedback(form, 'Глобальная тема сброшена к стандартной. Нажмите «Сохранить», чтобы зафиксировать изменение.');
        } else {
          state.themeUserDraft = {};
          state.themeUserSaved = {};
          clearThemeLayer('user');
          populateThemeForm(form, getActiveTheme(), layer);
          feedback(form, 'Личный пресет сброшен.');
        }
        form.dataset.reset = 'true';
      });
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const theme = readThemeFromForm(form);
      setDraftTheme(layer, theme);
      try {
        if (layer === 'global') {
          const body = form.dataset.reset ? { entries: {} } : { entries: entriesFromTheme(theme) };
          await fetch(`${API_BASE}/app-settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
          });
          state.themeGlobalSaved = form.dataset.reset ? {} : { ...theme };
          if (form.dataset.reset) {
            clearThemeLayer('global');
          } else {
            setThemeLayer('global', theme);
          }
          delete form.dataset.reset;
          feedback(form, 'Глобальная тема сохранена.');
        } else {
          const valuePayload = form.dataset.reset ? {} : theme;
          await fetch(`${API_BASE}/user/settings/theme_preferences`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ value: valuePayload }),
          });
          state.themeUserSaved = form.dataset.reset ? {} : { ...theme };
          if (form.dataset.reset) {
            clearThemeLayer('user');
          } else {
            setThemeLayer('user', theme);
          }
          delete form.dataset.reset;
          feedback(form, 'Личный пресет сохранён.');
        }
      } catch (err) {
        feedback(form, 'Не удалось сохранить изменения.', 'error');
      }
    });
  }

  function bindDashboardForm() {
    if (!forms.dashboard) return;
    forms.dashboard.addEventListener('submit', async (event) => {
      event.preventDefault();
      const widgets = [];
      forms.dashboard.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        if (input.checked) widgets.push(input.name);
      });
      state.layout.widgets = widgets;
      state.layout.hidden = [];
      try {
        await fetch(`${API_BASE}/user/settings/dashboard_layout`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ value: state.layout }),
        });
        feedback(forms.dashboard, 'Настройки виджетов сохранены.');
      } catch (err) {
        feedback(forms.dashboard, 'Не удалось сохранить.', 'error');
      }
    });
    const reset = forms.dashboard.querySelector('[data-dashboard-reset]');
    if (reset) {
      reset.addEventListener('click', (event) => {
        event.preventDefault();
        forms.dashboard.querySelectorAll('input[type="checkbox"]').forEach((input) => {
          input.checked = true;
        });
        state.layout.widgets = [];
        state.layout.hidden = [];
        feedback(forms.dashboard, 'Отметьте нужные карточки и сохраните изменения.');
      });
    }
  }

  function bindFavoritesForm() {
    if (!forms.favorites) return;
    forms.favorites.addEventListener('submit', async (event) => {
      event.preventDefault();
      const items = [];
      let position = 1;
      forms.favorites.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        if (input.checked) {
          items.push({
            path: input.name,
            label: input.dataset.label || input.name,
            position: position++,
          });
        }
      });
      state.favorites.items = items;
      try {
        await fetch(`${API_BASE}/user/settings/favorites`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ value: state.favorites }),
        });
        feedback(forms.favorites, 'Избранное обновлено.');
      } catch (err) {
        feedback(forms.favorites, 'Ошибка сохранения.', 'error');
      }
    });
    const reset = forms.favorites.querySelector('[data-favorites-reset]');
    if (reset) {
      reset.addEventListener('click', (event) => {
        event.preventDefault();
        forms.favorites.querySelectorAll('input[type="checkbox"]').forEach((input) => {
          input.checked = true;
        });
        state.favorites.items = [];
        feedback(forms.favorites, 'Все пункты отмечены. Сохраните, чтобы применить.');
      });
    }
  }

  function bindBrandingForm() {
    if (!forms.branding) return;
    forms.branding.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(forms.branding);
      const payload = {
        BRAND_NAME: fd.get('BRAND_NAME'),
        PUBLIC_URL: fd.get('PUBLIC_URL'),
        BOT_LANDING_URL: fd.get('BOT_LANDING_URL'),
      };
      try {
        const resp = await fetch(`${API_BASE}/admin/settings/branding`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          feedback(forms.branding, 'Брендинг сохранён.');
        } else {
          feedback(forms.branding, 'Не удалось сохранить брендинг.', 'error');
        }
      } catch (err) {
        feedback(forms.branding, 'Ошибка сети. Попробуйте позже.', 'error');
      }
    });
  }

  function bindTelegramForm() {
    if (!forms.telegram) return;
    forms.telegram.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(forms.telegram);
      const payload = {
        TG_LOGIN_ENABLED: !!fd.get('TG_LOGIN_ENABLED'),
        TG_BOT_USERNAME: (fd.get('TG_BOT_USERNAME') || '').toString().trim() || null,
        TG_BOT_TOKEN: (fd.get('TG_BOT_TOKEN') || '').toString().trim() || null,
      };
      try {
        const resp = await fetch(`${API_BASE}/admin/settings/telegram`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          feedback(forms.telegram, 'Настройки Telegram сохранены.');
        } else {
          feedback(forms.telegram, 'Не удалось сохранить Telegram настройки.', 'error');
        }
      } catch (err) {
        feedback(forms.telegram, 'Ошибка сети. Попробуйте позже.', 'error');
      }
    });
    forms.telegram.querySelectorAll('[data-restart]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        const target = btn.getAttribute('data-restart');
        try {
          const resp = await fetch(`${API_BASE}/admin/restart?target=${encodeURIComponent(target)}`, {
            method: 'POST',
            credentials: 'include',
          });
          const data = await resp.json().catch(() => ({}));
          if (data.ok) {
            feedback(forms.telegram, `Рестарт ${target} инициирован.`);
          } else {
            feedback(forms.telegram, data.error || 'Не удалось выполнить рестарт.', 'error');
          }
        } catch (err) {
          feedback(forms.telegram, 'Не удалось выполнить рестарт.', 'error');
        }
      });
    });
  }

  (async function init() {
    await fetchUserSettings();
    if (isAdmin) {
      await fetchGlobalTheme();
    }
    applyLayoutForm();
    applyFavoritesForm();
    bindDashboardForm();
    bindFavoritesForm();
    if (forms.userTheme) {
      bindThemeForm(forms.userTheme, 'user');
    }
    if (isAdmin && forms.globalTheme) {
      bindThemeForm(forms.globalTheme, 'global');
    }
    if (isAdmin) {
      bindBrandingForm();
      bindTelegramForm();
    }
  })();
}
