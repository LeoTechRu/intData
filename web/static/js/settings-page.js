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
    areas: [],
    areasLoading: false,
    areasError: null,
    selectedAreaId: null,
  };

  const forms = {
    dashboard: document.getElementById('dashboard-settings-form'),
    favorites: document.getElementById('favorites-settings-form'),
    userTheme: document.getElementById('user-theme-form'),
    globalTheme: document.getElementById('global-theme-form'),
    branding: document.getElementById('branding-form'),
    telegram: document.getElementById('telegram-form'),
  };

  const areasUI = {
    root: root.querySelector('[data-areas-root]'),
  };

  if (areasUI.root) {
    areasUI.tree = areasUI.root.querySelector('[data-areas-tree]');
    areasUI.skeleton = areasUI.root.querySelector('[data-areas-skeleton]');
    areasUI.empty = areasUI.root.querySelector('[data-areas-empty]');
    areasUI.status = areasUI.root.querySelector('[data-areas-status]');
    areasUI.createForm = areasUI.root.querySelector('[data-areas-create]');
    areasUI.createParent = areasUI.root.querySelector('[data-areas-parent]');
    areasUI.detail = areasUI.root.querySelector('[data-areas-detail]');
    areasUI.detailPanel = areasUI.root.querySelector('[data-areas-detail-panel]');
    areasUI.detailForm = areasUI.root.querySelector('[data-areas-detail-form]');
    areasUI.detailName = areasUI.root.querySelector('[data-areas-detail-name]');
    areasUI.detailPath = areasUI.root.querySelector('[data-areas-detail-path]');
    areasUI.detailParent = areasUI.root.querySelector('[data-areas-detail-parent]');
    areasUI.detailMeta = areasUI.root.querySelector('[data-areas-detail-meta]');
    areasUI.detailEmpty = areasUI.root.querySelector('[data-areas-detail-empty]');
    areasUI.detailCancel = areasUI.root.querySelector('[data-areas-detail-cancel]');
  }

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

  function setFormDisabled(form, disabled) {
    if (!form) return;
    Array.from(form.elements || []).forEach((el) => {
      if (el && typeof el.disabled === 'boolean') {
        // eslint-disable-next-line no-param-reassign
        el.disabled = disabled;
      }
    });
    if (disabled) {
      form.setAttribute('aria-disabled', 'true');
    } else {
      form.removeAttribute('aria-disabled');
    }
  }

  function sortAreas(items) {
    return [...items].sort((a, b) => {
      const left = (a.mp_path || '').toLowerCase();
      const right = (b.mp_path || '').toLowerCase();
      return left.localeCompare(right);
    });
  }

  function getAreaById(id) {
    return state.areas.find((area) => area.id === id) || null;
  }

  function buildAreaTrail(area) {
    if (!area) return [];
    const map = new Map(state.areas.map((item) => [item.id, item]));
    const trail = [];
    let current = area;
    while (current) {
      trail.push(current);
      current = current.parent_id ? map.get(current.parent_id) : null;
    }
    return trail.reverse();
  }

  function isDescendant(candidate, ancestor) {
    const ancestorArea = typeof ancestor === 'object' ? ancestor : getAreaById(Number(ancestor));
    if (!ancestorArea || !candidate) return false;
    if (candidate.id === ancestorArea.id) return false;
    const prefix = ancestorArea.mp_path || '';
    if (!prefix) return false;
    const path = candidate.mp_path || '';
    return path.startsWith(prefix);
  }

  function renderParentSelect(select, { excludeAreaId = null, defaultValue } = {}) {
    if (!select) return;
    const previous = select.value;
    const sorted = sortAreas(state.areas);
    select.innerHTML = '';
    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = 'Верхний уровень';
    select.appendChild(noneOption);
    const excluded = excludeAreaId ? getAreaById(excludeAreaId) : null;
    sorted.forEach((area) => {
      if (excludeAreaId && (area.id === excludeAreaId || isDescendant(area, excluded))) {
        return;
      }
      const option = document.createElement('option');
      option.value = String(area.id);
      option.textContent = `${'— '.repeat(area.depth || 0)}${area.name}`;
      select.appendChild(option);
    });
    if (defaultValue !== undefined && defaultValue !== null) {
      select.value = String(defaultValue);
    } else if (defaultValue === null) {
      select.value = '';
    } else if (previous) {
      select.value = previous;
    }
    if (!select.value && excludeAreaId === null && state.selectedAreaId) {
      const exists = sorted.some((item) => String(item.id) === String(state.selectedAreaId));
      if (exists) {
        select.value = String(state.selectedAreaId);
      }
    }
  }

  function renderAreasStatus() {
    if (!areasUI.status) return;
    areasUI.status.textContent = '';
    areasUI.status.dataset.type = '';
    if (state.areasError === 'unauthorized') {
      areasUI.status.dataset.type = 'info';
      areasUI.status.innerHTML = 'Подключите Telegram-аккаунт, чтобы управлять областями из веб-интерфейса. Бот: <a href="https://intdata.pro/bot" target="_blank" rel="noopener">@intDataBot</a>.';
    } else if (state.areasError === 'network') {
      areasUI.status.dataset.type = 'error';
      areasUI.status.textContent = 'Не удалось загрузить области. Проверьте соединение и повторите попытку.';
    }
  }

  function renderAreasTree() {
    if (!areasUI.tree) return;
    areasUI.tree.innerHTML = '';
    if (!state.areas.length || state.areasLoading || state.areasError) {
      areasUI.tree.setAttribute('aria-activedescendant', '');
      return;
    }
    const sorted = sortAreas(state.areas);
    sorted.forEach((area) => {
      const li = document.createElement('li');
      li.className = 'areas-tree__item';
      li.dataset.areaId = String(area.id);
      li.setAttribute('role', 'treeitem');
      li.setAttribute('aria-level', String((area.depth || 0) + 1));
      const isSelected = state.selectedAreaId === area.id;
      li.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `areas-node__button${isSelected ? ' areas-node__button--selected' : ''}`;
      button.dataset.areaId = String(area.id);
      button.id = `area-node-${area.id}`;
      const color = document.createElement('span');
      color.className = 'areas-node__color';
      color.style.backgroundColor = area.color || '#F1F5F9';
      button.appendChild(color);
      const label = document.createElement('span');
      label.className = 'areas-node__label';
      label.textContent = area.name;
      button.appendChild(label);
      const meta = document.createElement('span');
      meta.className = 'areas-node__meta';
      meta.textContent = area.mp_path ? area.mp_path.replace(/\.$/, '') : '';
      button.appendChild(meta);
      li.appendChild(button);
      areasUI.tree.appendChild(li);
      if (isSelected) {
        areasUI.tree.setAttribute('aria-activedescendant', button.id);
      }
    });
  }

  function renderAreasDetail() {
    if (!areasUI.detail) return;
    const area = getAreaById(state.selectedAreaId);
    const hasArea = Boolean(area);
    if (!areasUI.detailEmpty || !areasUI.detailPanel) return;
    areasUI.detail.dataset.state = hasArea ? 'selected' : 'empty';
    areasUI.detailEmpty.hidden = !!hasArea;
    areasUI.detailPanel.hidden = !hasArea;
    if (!hasArea) {
      if (areasUI.detailForm) {
        areasUI.detailForm.reset();
      }
      return;
    }
    const trail = buildAreaTrail(area);
    if (areasUI.detailName) {
      areasUI.detailName.textContent = area.name;
    }
    if (areasUI.detailPath) {
      areasUI.detailPath.textContent = trail.map((item) => item.name).join(' → ');
    }
    if (areasUI.detailForm) {
      const nameField = areasUI.detailForm.querySelector('input[name="name"]');
      if (nameField) {
        nameField.value = area.name;
      }
      renderParentSelect(areasUI.detailParent, { excludeAreaId: area.id, defaultValue: area.parent_id ?? '' });
    }
    if (areasUI.detailMeta) {
      areasUI.detailMeta.textContent = `ID: ${area.id} • slug: ${area.slug || '—'}`;
    }
  }

  function renderAreas() {
    if (!areasUI.root) return;
    if (areasUI.skeleton) {
      areasUI.skeleton.hidden = !state.areasLoading;
    }
    if (areasUI.tree) {
      areasUI.tree.hidden = Boolean(state.areasLoading || state.areasError);
    }
    const lockForms = state.areasError === 'unauthorized';
    if (areasUI.createForm) {
      setFormDisabled(areasUI.createForm, lockForms);
    }
    if (areasUI.detailForm) {
      setFormDisabled(areasUI.detailForm, lockForms);
    }
    if (areasUI.empty) {
      areasUI.empty.hidden = !(!state.areasLoading && !state.areasError && state.areas.length === 0);
    }
    renderAreasStatus();
    if (!state.areas.length && !state.areasLoading && !state.areasError) {
      state.selectedAreaId = null;
    } else if (state.selectedAreaId) {
      const exists = state.areas.some((item) => item.id === state.selectedAreaId);
      if (!exists) {
        state.selectedAreaId = state.areas.length ? state.areas[0].id : null;
      }
    } else if (state.areas.length) {
      state.selectedAreaId = state.areas[0].id;
    }
    renderParentSelect(areasUI.createParent, { defaultValue: state.selectedAreaId ?? '' });
    renderAreasTree();
    renderAreasDetail();
  }

  async function fetchAreas(selectAfterId) {
    if (!areasUI.root) return;
    state.areasLoading = true;
    renderAreas();
    try {
      const resp = await fetch(`${API_BASE}/areas`, { credentials: 'include' });
      if (resp.status === 401) {
        state.areas = [];
        state.selectedAreaId = null;
        state.areasError = 'unauthorized';
        return;
      }
      if (!resp.ok) {
        throw new Error('Failed to load areas');
      }
      const data = await resp.json();
      state.areasError = null;
      state.areas = Array.isArray(data) ? data : [];
      if (selectAfterId) {
        const exists = state.areas.some((item) => item.id === selectAfterId);
        state.selectedAreaId = exists ? selectAfterId : state.selectedAreaId;
      }
    } catch (err) {
      state.areas = [];
      state.selectedAreaId = null;
      state.areasError = 'network';
    } finally {
      state.areasLoading = false;
      renderAreas();
    }
  }

  function handleTreeSelection(event) {
    const target = event.target.closest('[data-area-id]');
    if (!target) return;
    const id = Number.parseInt(target.dataset.areaId, 10);
    if (Number.isNaN(id)) return;
    state.selectedAreaId = id;
    renderAreasTree();
    renderAreasDetail();
    const nameField = areasUI.detailForm?.querySelector('input[name="name"]');
    if (nameField) {
      nameField.focus({ preventScroll: false });
    }
  }

  function handleTreeKeydown(event) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (!state.areas.length) return;
    event.preventDefault();
    const sorted = sortAreas(state.areas);
    const currentIndex = sorted.findIndex((item) => item.id === state.selectedAreaId);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < sorted.length - 1 ? currentIndex + 1 : 0;
    } else if (event.key === 'ArrowUp') {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : sorted.length - 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = sorted.length - 1;
    }
    const nextArea = sorted[nextIndex];
    if (nextArea) {
      state.selectedAreaId = nextArea.id;
      renderAreasTree();
      renderAreasDetail();
      const button = areasUI.tree?.querySelector(`[data-area-id="${nextArea.id}"]`);
      if (button) button.focus({ preventScroll: false });
    }
  }

  async function handleCreateAreaSubmit(event) {
    event.preventDefault();
    if (!areasUI.createForm) return;
    const fd = new FormData(areasUI.createForm);
    const name = (fd.get('name') || '').toString().trim();
    if (!name) {
      feedback(areasUI.createForm, 'Название обязательно.', 'error');
      return;
    }
    const colorRaw = (fd.get('color') || '').toString().trim();
    const parentRaw = (fd.get('parent_id') || '').toString().trim();
    const payload = {
      name,
      color: colorRaw || null,
      parent_id: parentRaw ? Number(parentRaw) : null,
    };
    try {
      setFormDisabled(areasUI.createForm, true);
      const resp = await fetch(`${API_BASE}/areas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const error = await resp.json().catch(() => ({}));
        throw new Error(error.detail || 'Не удалось создать область');
      }
      const data = await resp.json();
      areasUI.createForm.reset();
      areasUI.createForm.querySelector('input[name="color"]').value = '#F1F5F9';
      feedback(areasUI.createForm, 'Область создана.');
      await fetchAreas(data?.id);
    } catch (err) {
      feedback(areasUI.createForm, err.message || 'Не удалось создать область.', 'error');
    } finally {
      setFormDisabled(areasUI.createForm, false);
    }
  }

  async function handleDetailSubmit(event) {
    event.preventDefault();
    if (!areasUI.detailForm) return;
    const area = getAreaById(state.selectedAreaId);
    if (!area) {
      feedback(areasUI.detailForm, 'Выберите область для редактирования.', 'error');
      return;
    }
    const fd = new FormData(areasUI.detailForm);
    const newName = (fd.get('name') || '').toString().trim();
    const parentRaw = (fd.get('parent_id') || '').toString().trim();
    const nextParent = parentRaw ? Number(parentRaw) : null;
    const ops = [];
    try {
      setFormDisabled(areasUI.detailForm, true);
      if (newName && newName !== area.name) {
        const resp = await fetch(`${API_BASE}/areas/${area.id}/rename`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: newName }),
        });
        if (!resp.ok) {
          const error = await resp.json().catch(() => ({}));
          throw new Error(error.detail || 'Не удалось переименовать область');
        }
        ops.push('rename');
      }
      const currentParent = area.parent_id ?? null;
      if (nextParent !== currentParent) {
        const resp = await fetch(`${API_BASE}/areas/${area.id}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ new_parent_id: nextParent }),
        });
        if (!resp.ok) {
          const error = await resp.json().catch(() => ({}));
          throw new Error(error.detail || 'Не удалось переместить область');
        }
        ops.push('move');
      }
      if (!ops.length) {
        feedback(areasUI.detailForm, 'Изменений не обнаружено.');
        return;
      }
      await fetchAreas(area.id);
      feedback(areasUI.detailForm, 'Изменения сохранены.');
    } catch (err) {
      feedback(areasUI.detailForm, err.message || 'Не удалось обновить область.', 'error');
    } finally {
      setFormDisabled(areasUI.detailForm, false);
    }
  }

  function handleDetailCancel(event) {
    event.preventDefault();
    renderAreasDetail();
    if (areasUI.detailForm) {
      feedback(areasUI.detailForm, 'Изменения отменены.');
    }
  }

  function initAreasSection() {
    if (!areasUI.root) return;
    if (areasUI.createForm) {
      areasUI.createForm.addEventListener('submit', handleCreateAreaSubmit);
    }
    if (areasUI.detailForm) {
      areasUI.detailForm.addEventListener('submit', handleDetailSubmit);
    }
    if (areasUI.detailCancel) {
      areasUI.detailCancel.addEventListener('click', handleDetailCancel);
    }
    if (areasUI.tree) {
      areasUI.tree.addEventListener('click', handleTreeSelection);
      areasUI.tree.addEventListener('keydown', handleTreeKeydown);
    }
    fetchAreas();
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
          const body = form.dataset.reset
            ? { entries: {}, reset_prefix: 'theme.global.' }
            : { entries: entriesFromTheme(theme) };
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
    initAreasSection();
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
