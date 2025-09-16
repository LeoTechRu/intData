// Example TypeScript entry point with modular structure
const _origFetch = window.fetch;
window.fetch = async (input, init = {}) => {
    const resp = await _origFetch(input, Object.assign(Object.assign({}, init), { redirect: 'manual' }));
    if (resp.status === 307 || resp.status === 308) {
        const location = resp.headers.get('Location');
        if (location) {
            console.warn('API redirect', input, '→', location);
            return _origFetch(location, init);
        }
    }
    return resp;
};
export function enableAccessibility() {
    const btn = document.getElementById('accessibility-toggle');
    if (!btn)
        return;
    btn.addEventListener('click', () => {
        document.documentElement.classList.toggle('high-contrast');
    });
}
export function initProfileEditForm() {
    const form = document.getElementById('profile-edit-form');
    if (!form)
        return;
    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const formData = new FormData(form);
        const resp = await fetch(window.location.pathname, {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });
        if (resp.ok) {
            const html = await resp.text();
            const container = document.getElementById('main-content');
            if (container) {
                container.innerHTML = html;
                initProfileEditForm();
            }
        }
    });
}
export function initDashboardCompact() {
    const button = document.getElementById('compact-toggle');
    if (!button)
        return;
    const body = document.body;
    const apply = (enabled) => {
        body.classList.toggle('compact', enabled);
    };
    let compact = localStorage.getItem('dashboardCompact') === 'true';
    apply(compact);
    button.addEventListener('click', () => {
        compact = !compact;
        localStorage.setItem('dashboardCompact', String(compact));
        apply(compact);
    });
}

export function initCardLinks() {
    document.querySelectorAll('[data-href]').forEach((el) => {
        el.addEventListener('click', (ev) => {
            const target = ev.target;
            if (target instanceof Element && target.closest('a,button,textarea,input,select,form')) {
                return;
            }
            const url = el.getAttribute('data-href');
            if (url)
                window.location.href = url;
        });
    });
}
import { initPersonaHeader } from './persona-header.js';
import { API_BASE } from './services/apiBase.js';

let userFavorites = { v: 1, items: [] };
let dashboardLayout = { v: 1, layouts: {}, widgets: [], hidden: [] };

function renderFavorites() {
    const favBox = document.querySelector('[data-fav-box]');
    if (!favBox)
        return;
    const items = (userFavorites.items || []).sort((a, b) => (a.position || 0) - (b.position || 0));
    favBox.innerHTML = '';
    if (!items.length) {
        const li = document.createElement('li');
        li.className = 'muted';
        li.textContent = 'Избранное пусто';
        favBox.appendChild(li);
    }
    else {
        for (const it of items) {
            const li = document.createElement('li');
            li.setAttribute('role', 'none');
            const a = document.createElement('a');
            a.href = it.path;
            a.textContent = it.label || it.path;
            a.setAttribute('role', 'menuitem');
            li.appendChild(a);
            favBox.appendChild(li);
        }
    }
}

function updateFavToggle() {
    const btn = document.querySelector('[data-fav-toggle]');
    if (!btn)
        return;
    const path = btn.dataset.path || window.location.pathname;
    const exists = userFavorites.items?.some((it) => it.path === path);
    btn.setAttribute('aria-pressed', exists ? 'true' : 'false');
    btn.textContent = exists ? '★' : '☆';
    btn.setAttribute('aria-label', exists ? 'Убрать из избранного' : 'Добавить в избранное');
}

export function initFavoriteToggle() {
    const btn = document.querySelector('[data-fav-toggle]');
    if (!btn)
        return;
    btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        const path = btn.dataset.path || window.location.pathname;
        const label = btn.dataset.label || path;
        let items = userFavorites.items || [];
        const idx = items.findIndex((it) => it.path === path);
        if (idx >= 0) {
            items.splice(idx, 1);
        }
        else {
            items.push({ label, path, position: items.length + 1 });
        }
        userFavorites.items = items.map((it, i) => (Object.assign(Object.assign({}, it), { position: i + 1 })));
        try {
            await fetch(`${API_BASE}/user/settings/favorites`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ value: userFavorites }),
            });
        }
        catch (_a) {
            // ignore
        }
        renderFavorites();
        updateFavToggle();
    });
}

export async function loadUserSettings() {
    try {
        const resp = await fetch(`${API_BASE}/user/settings?keys=dashboard_layout,favorites`, { credentials: 'include' });
        if (!resp.ok)
            return;
        const data = await resp.json();
        userFavorites = data.favorites || { v: 1, items: [] };
        dashboardLayout = data.dashboard_layout || dashboardLayout;
        renderFavorites();
        updateFavToggle();
        applyDashboardLayout();
    }
    catch (e) {
        // ignore
    }
}

export async function saveDashboardLayout(layout) {
    await fetch(`${API_BASE}/user/settings/dashboard_layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value: layout }),
    });
    dashboardLayout = layout;
    applyDashboardLayout();
}

function applyDashboardLayout() {
    const container = document.querySelector('[data-dashboard]');
    if (!container)
        return;
    const elements = Array.from(container.querySelectorAll('[data-widget]'));
    if (!elements.length)
        return;
    const savedOrder = Array.isArray(dashboardLayout === null || dashboardLayout === void 0 ? void 0 : dashboardLayout.widgets)
        ? [...dashboardLayout.widgets]
        : [];
    const savedHidden = Array.isArray(dashboardLayout === null || dashboardLayout === void 0 ? void 0 : dashboardLayout.hidden)
        ? [...dashboardLayout.hidden]
        : [];
    if (!savedOrder.length) {
        const fallbackOrder = elements
            .map((el) => el.dataset.widget || '')
            .filter(Boolean);
        const hiddenSet = new Set(savedHidden);
        dashboardLayout.widgets = fallbackOrder.filter((key) => !hiddenSet.has(key));
        if (!dashboardLayout.hidden)
            dashboardLayout.hidden = savedHidden;
    }
    const orderKeys = Array.isArray(dashboardLayout.widgets) ? dashboardLayout.widgets : [];
    if (orderKeys.length) {
        const order = new Map(orderKeys.map((key, index) => [key, index]));
        const sorted = elements.slice().sort((a, b) => {
            const aKey = a.dataset.widget || '';
            const bKey = b.dataset.widget || '';
            const aIndex = order.has(aKey) ? order.get(aKey) : Number.MAX_SAFE_INTEGER;
            const bIndex = order.has(bKey) ? order.get(bKey) : Number.MAX_SAFE_INTEGER;
            return aIndex - bIndex;
        });
        sorted.forEach((node) => container.appendChild(node));
    }
    elements.forEach((el) => {
        const key = el.dataset.widget || '';
        let hide = false;
        if (orderKeys.length) {
            hide = !orderKeys.includes(key);
        }
        else if (savedHidden.length) {
            hide = savedHidden.includes(key);
        }
        el.hidden = hide;
        el.classList.toggle('dashboard-widget-hidden', hide);
    });
}

function initDashboardEditor() {
    const container = document.querySelector('[data-dashboard]');
    const toggle = document.querySelector('[data-dashboard-edit]');
    const panel = document.querySelector('[data-dashboard-editor]');
    const hiddenList = panel === null || panel === void 0 ? void 0 : panel.querySelector('[data-dashboard-hidden-list]');
    if (!container || !toggle || !panel || !hiddenList)
        return;
    let editing = false;
    let dragSource = null;
    function widgetKey(el) {
        var _a;
        return ((_a = el === null || el === void 0 ? void 0 : el.dataset) === null || _a === void 0 ? void 0 : _a.widget) || '';
    }
    function allWidgets() {
        return Array.from(container.querySelectorAll('[data-widget]'));
    }
    function visibleWidgets() {
        return allWidgets()
            .filter((el) => !el.hidden)
            .map((el) => widgetKey(el))
            .filter(Boolean);
    }
    function hiddenWidgets() {
        return allWidgets()
            .filter((el) => el.hidden)
            .map((el) => widgetKey(el))
            .filter(Boolean);
    }
    function ensureLayoutDefaults() {
        if (!Array.isArray(dashboardLayout.hidden)) {
            dashboardLayout.hidden = [];
        }
        if (!Array.isArray(dashboardLayout.widgets) || dashboardLayout.widgets.length === 0) {
            const hiddenSet = new Set(dashboardLayout.hidden);
            dashboardLayout.widgets = allWidgets()
                .map((el) => widgetKey(el))
                .filter((key) => key && !hiddenSet.has(key));
        }
    }
    function updateToggleLabel() {
        toggle.textContent = editing ? 'Готово' : 'Настроить дашборд';
    }
    function refreshHiddenList() {
        hiddenList.innerHTML = '';
        const hiddenKeys = hiddenWidgets();
        if (!hiddenKeys.length) {
            const li = document.createElement('li');
            li.className = 'dashboard-editor-panel__empty';
            li.textContent = 'Все виджеты отображаются';
            hiddenList.appendChild(li);
            return;
        }
        hiddenKeys.forEach((key) => {
            const widget = container.querySelector(`[data-widget="${key}"]`);
            const li = document.createElement('li');
            li.className = 'dashboard-editor-panel__item';
            const titleNode = widget === null || widget === void 0 ? void 0 : widget.querySelector('.card-title');
            const titleText = titleNode && titleNode.textContent ? titleNode.textContent.trim() : '';
            const title = titleText || key;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'button button--ghost';
            button.textContent = `Показать «${title}»`;
            button.addEventListener('click', () => {
                if (!widget)
                    return;
                widget.hidden = false;
                widget.classList.remove('dashboard-widget-hidden');
                dashboardLayout.hidden = (dashboardLayout.hidden || []).filter((k) => k !== key);
                const nextOrder = new Set(dashboardLayout.widgets || []);
                nextOrder.add(key);
                dashboardLayout.widgets = Array.from(nextOrder);
                container.appendChild(widget);
                persistLayout();
            });
            li.appendChild(button);
            hiddenList.appendChild(li);
        });
    }
    function addOverlay(el) {
        if (el.querySelector('.dashboard-widget__overlay'))
            return;
        const overlay = document.createElement('div');
        overlay.className = 'dashboard-widget__overlay';
        const handle = document.createElement('span');
        handle.className = 'dashboard-widget__handle';
        handle.setAttribute('aria-hidden', 'true');
        handle.textContent = '⇅';
        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'dashboard-widget__hide';
        hideBtn.setAttribute('aria-label', 'Скрыть виджет');
        hideBtn.textContent = '×';
        overlay.appendChild(handle);
        overlay.appendChild(hideBtn);
        el.appendChild(overlay);
    }
    function removeOverlays() {
        container.querySelectorAll('.dashboard-widget__overlay').forEach((node) => node.remove());
    }
    function persistLayout() {
        ensureLayoutDefaults();
        dashboardLayout.widgets = visibleWidgets();
        dashboardLayout.hidden = hiddenWidgets();
        saveDashboardLayout(dashboardLayout).catch(() => { });
        refreshHiddenList();
    }
    function enterEditMode() {
        editing = true;
        container.classList.add('dashboard--editing');
        toggle.setAttribute('aria-pressed', 'true');
        panel.hidden = false;
        allWidgets().forEach((el) => {
            el.draggable = true;
            el.classList.add('dashboard-widget--editable');
            addOverlay(el);
        });
        updateToggleLabel();
        refreshHiddenList();
    }
    function exitEditMode() {
        editing = false;
        container.classList.remove('dashboard--editing');
        toggle.setAttribute('aria-pressed', 'false');
        panel.hidden = true;
        allWidgets().forEach((el) => {
            el.removeAttribute('draggable');
            el.classList.remove('dashboard-widget--editable');
        });
        removeOverlays();
        updateToggleLabel();
        persistLayout();
    }
    toggle.addEventListener('click', () => {
        ensureLayoutDefaults();
        if (editing) {
            exitEditMode();
        }
        else {
            enterEditMode();
        }
    });
    container.addEventListener('click', (event) => {
        if (!editing)
            return;
        const hideBtn = event.target.closest('.dashboard-widget__hide');
        if (!hideBtn)
            return;
        const widget = hideBtn.closest('[data-widget]');
        const key = widgetKey(widget);
        if (!key)
            return;
        widget.hidden = true;
        widget.classList.add('dashboard-widget-hidden');
        dashboardLayout.widgets = (dashboardLayout.widgets || []).filter((k) => k !== key);
        const hiddenSet = new Set(dashboardLayout.hidden || []);
        hiddenSet.add(key);
        dashboardLayout.hidden = Array.from(hiddenSet);
        persistLayout();
    });
    container.addEventListener('dragstart', (event) => {
        if (!editing) {
            event.preventDefault();
            return;
        }
        const widget = event.target.closest('[data-widget]');
        if (!widget || widget.hidden) {
            event.preventDefault();
            return;
        }
        dragSource = widget;
        widget.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', widgetKey(widget));
    });
    container.addEventListener('dragend', () => {
        if (dragSource) {
            dragSource.classList.remove('is-dragging');
            dragSource = null;
        }
    });
    container.addEventListener('dragover', (event) => {
        if (!editing)
            return;
        const target = event.target.closest('[data-widget]');
        if (!target || target.hidden)
            return;
        event.preventDefault();
    });
    container.addEventListener('drop', (event) => {
        if (!editing)
            return;
        event.preventDefault();
        if (!dragSource)
            return;
        const target = event.target.closest('[data-widget]');
        if (!target || target === dragSource || target.hidden)
            return;
        const rect = target.getBoundingClientRect();
        const after = event.clientY > rect.top + rect.height / 2;
        container.insertBefore(dragSource, after ? target.nextSibling : target);
        dragSource.classList.remove('is-dragging');
        dragSource = null;
        persistLayout();
    });
}

function initAdminIframe() {
    const frame = document.querySelector('[data-admin-iframe]');
    if (!frame)
        return;
    const resize = () => {
        try {
            const doc = frame.contentDocument;
            if (!doc || !doc.body)
                return;
            const height = doc.body.scrollHeight || doc.documentElement.scrollHeight;
            if (height)
                frame.style.height = `${Math.max(height, 480)}px`;
        }
        catch (_a) {
            /* ignore cross-origin */
        }
    };
    frame.addEventListener('load', () => {
        resize();
        try {
            if ('ResizeObserver' in window) {
                const doc = frame.contentDocument;
                if (doc && doc.body) {
                    const observer = new ResizeObserver(() => resize());
                    observer.observe(doc.body);
                    frame.addEventListener('load', () => observer.disconnect(), { once: true });
                }
            }
        }
        catch (_a) {
            /* ignore */
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    enableAccessibility();
    initProfileEditForm();
    initDashboardCompact();
    initPersonaHeader();
    initCardLinks();
    initFavoriteToggle();
    initDashboardEditor();
    initAdminIframe();
    loadUserSettings();
});
(function(){
  function applyNoGridIfNeeded(){
    try {
      if (!('CSS' in window && CSS.supports && CSS.supports('display', 'grid'))) {
        document.body.classList.add('no-grid');
      }
    } catch(e) {
      // на всякий случай при ошибке фичи — тоже fallback
      document.body.classList.add('no-grid');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyNoGridIfNeeded);
  } else {
    applyNoGridIfNeeded();
  }
})();

// (header responsive logic removed — navigation moved into profile menu)

// ===== Убрать случайные ссылки 'Подробнее' из хедера (подстраховка) =====
(function(){
  const hdr = document.querySelector('header.top-bar');
  if (!hdr) return;
  hdr.querySelectorAll('a,button').forEach(el=>{
    if ((el.textContent||'').trim() === 'Подробнее') el.remove();
  });
})();

// ===== Timer modal & API =====
(function(){
  const btn = document.getElementById('timerToggle');
  const modal = document.getElementById('timerModal');
  if (!btn || !modal || !window.TIMER_ENDPOINTS) return;

  const startBtn = document.getElementById('timerStartBtn');
  const stopBtn  = document.getElementById('timerStopBtn');
  const info     = document.getElementById('timerInfo');
  const desc     = document.getElementById('timerDesc');
  const dot      = btn.querySelector('.timer-dot');
  let runningId = null;

  async function getJSON(url){ const r = await fetch(url, {cache:'no-store'}); try { return await r.json(); } catch { return null; } }
  async function postJSON(url, payload){
    const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload||{}) });
    try { return await r.json(); } catch { return null; }
  }
  function fmt(dt){ try { return new Date(dt).toLocaleString(); } catch { return dt || ''; } }

  async function refresh(){
    try{
      const data = await getJSON(window.TIMER_ENDPOINTS.status);
      let current = null;
      if (Array.isArray(data)) current = data.find(e=>!e.end_time);
      runningId = current ? current.id : null;
      const running = Boolean(runningId);
      if (startBtn) startBtn.hidden = running;
      if (stopBtn) stopBtn.hidden  = !running;
      if (dot) dot.hidden = !running;
      if (info) info.textContent = running ? `Идёт с ${fmt(current.start_time)}` : 'Таймер не запущен';
    }catch(e){ /* no-op */ }
  }

  btn.addEventListener('click', ()=>{ try { modal.showModal(); } catch { /* fallback for <dialog> unsupported */ modal.setAttribute('open',''); } refresh(); });
  modal.addEventListener('click', (e)=>{ if (e.target.dataset && e.target.dataset.close) { try { modal.close(); } catch { modal.removeAttribute('open'); } }});

  startBtn?.addEventListener('click', async ()=>{
    await postJSON(window.TIMER_ENDPOINTS.start, { description: (desc && desc.value) || null });
    if (desc) desc.value = '';
    refresh();
  });
  stopBtn?.addEventListener('click', async ()=>{
    if (!runningId) return;
    const url = (window.TIMER_ENDPOINTS.stopOf ? window.TIMER_ENDPOINTS.stopOf(runningId) : null);
    if (!url) return;
    await postJSON(url, {});
    refresh();
  });

  setInterval(refresh, 60000);
  refresh();
})();

// auth: toggle password
(function(){
  function onClick(e){
    const btn = e.target.closest('.toggle-password');
    if (!btn) return;
    const input = btn.parentElement.querySelector('input.control[type="password"], input.control[type="text"]');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  }
  document.addEventListener('click', onClick);
})();

// профиль-меню (новое меню в аватаре)
(function(){
  const btn = document.getElementById('profileMenuBtn');
  const menu = document.getElementById('profileMenu');
  if (!btn || !menu) return;

  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  const open  = () => { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden ? open() : close();
  });

  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) close();
  });

  // Esc to close
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  // Intercept non-GET links inside menu (e.g., logout)
  menu.addEventListener('click', async (ev) => {
    const a = ev.target && ev.target.closest && ev.target.closest('a');
    if (!a) return;
    const method = (a.dataset && a.dataset.method || '').toUpperCase();
    if (method && method !== 'GET') {
      ev.preventDefault();
      try{
        const resp = await fetch(a.href, { method, credentials: 'include' });
        if (resp.redirected) { window.location.href = resp.url; }
        else if (resp.ok) { window.location.reload(); }
      } catch {}
    }
    close();
  });
})();

// Быстрая заметка на дашборде
(function(){
  const form = document.getElementById('quick-note-form');
  if (!form) return;
  const result = document.getElementById('quick-note-result');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const content = (fd.get('content') || '').toString().trim();
    if (!content) return;

    const r = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content })
    });
    if (r.ok) {
      form.reset();
      if (result) { result.hidden = false; setTimeout(()=> result.hidden = true, 1500); }
    } else {
      alert('Не удалось сохранить заметку');
    }
  });
})();

// auth: form switcher on /auth
(function(){
const forms = {
  login: document.querySelector('.form-login'),
  register: document.querySelector('.form-register'),
  restore: document.querySelector('.form-restore'),
};
if (!forms.login) return;

function activate(name){
  Object.keys(forms).forEach(k=>{
    forms[k]?.classList.toggle('is-hidden', k!==name);
  });
  if (location.hash !== '#'+name) history.replaceState(null,'','#'+name);
}

document.addEventListener('click', (e)=>{
  const j = e.target.closest('[data-tab-jump]');
  if (j){ e.preventDefault(); activate(j.dataset.tabJump); }
});

const hash = (location.hash||'').replace('#','');
let defaultTab = 'login';
for (const [name, form] of Object.entries(forms)){
  if (form && !form.classList.contains('is-hidden')){ defaultTab = name; break; }
}
activate(hash && forms[hash] ? hash : defaultTab);
})();

// ===== Popover widgets =====
(function(){
  const q = (s) => document.querySelector(s);
  const widgets = {
    tasks: { btnSel:'[data-widget="tasks"]', dlg:q('#wTasks') },
    rc:    { btnSel:'[data-widget="rc"]',    dlg:q('#wRC')    },
    notes: { btnSel:'[data-widget="notes"]', dlg:q('#wNotes') },
  };

  function placeNear(btn, card){
    if (!btn || !card) return;
    const r = btn.getBoundingClientRect();
    // place below with small offset; clamp to viewport with 12px padding
    const left = Math.min(Math.max(12, r.left), Math.max(12, window.innerWidth - (card.offsetWidth || 320) - 12));
    card.style.top  = (r.bottom + 8) + 'px';
    card.style.left = left + 'px';
  }
  function closeAll(except){
    Object.values(widgets).forEach(w=>{ if (w.dlg && w.dlg !== except && w.dlg.open) { try { w.dlg.close(); } catch{} } });
  }

  function bindOpen(key){
    const w = widgets[key];
    const btn = document.querySelector(w.btnSel);
    if (!btn || !w.dlg) return;
    btn.addEventListener('click', async ()=>{
      closeAll(w.dlg);
      try { w.dlg.showModal(); } catch { w.dlg.setAttribute('open',''); }
      const card = w.dlg.querySelector('.popover-card');
      placeNear(btn, card);
      if (card) {
        card.setAttribute('tabindex','-1');
        try { card.focus({preventScroll:true}); } catch { card.focus(); }
      }
      await loadWidget(key);
    });
    document.addEventListener('click', (e)=>{
      if (!w.dlg.open) return;
      if (!w.dlg.contains(e.target) && e.target !== btn) { try { w.dlg.close(); } catch { w.dlg.removeAttribute('open'); } }
    });
    window.addEventListener('resize', ()=>{ if (w.dlg.open) placeNear(btn, w.dlg.querySelector('.popover-card')); });
  }
  Object.keys(widgets).forEach(bindOpen);

  // Delegated handler for dynamically cloned buttons (e.g., in hamburger drawer)
  document.addEventListener('click', async (e)=>{
    const btn = e.target && e.target.closest && e.target.closest('.nav-pill[data-widget]');
    if (!btn) return;
    const key = btn.getAttribute('data-widget');
    if (!key || !(key in widgets)) return;
    const w = widgets[key];
    if (!w.dlg) return;
    closeAll(w.dlg);
    try { w.dlg.showModal(); } catch { w.dlg.setAttribute('open',''); }
    const card = w.dlg.querySelector('.popover-card');
    placeNear(btn, card);
    if (card) {
      card.setAttribute('tabindex','-1');
      try { card.focus({preventScroll:true}); } catch { card.focus(); }
    }
    await loadWidget(key);
  });

  const fmtTime = (d)=> { try { return new Date(d).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); } catch { return '';} };
  const isoDate = (d)=> (d||'').slice(0,10);
  const todayISO = ()=> new Date().toISOString().slice(0,10);

  async function loadWidget(key){
    if (key==='tasks'){
      const ul = q('#wTasksList'); if (!ul) return; ul.innerHTML='…';
      let items = [];
      try{
        const r = await fetch(`${API_BASE}/tasks`, {credentials:'same-origin'});
        const data = await r.json();
        items = Array.isArray(data) ? data.filter(t=> (t.due_date||'').startsWith(todayISO())) : [];
      }catch{}
      ul.innerHTML = items.length ? '' : '<li class="muted">На сегодня задач нет</li>';
      items.slice(0,6).forEach(t=>{
        const li = document.createElement('li');
        const time = t.due_date ? fmtTime(t.due_date) : '';
        li.innerHTML = `<span>${t.title||''}</span><span class="due">${time}</span>`;
        ul.appendChild(li);
      });
    }
    if (key==='rc'){
      const ev = q('#wEvents'); if (!ev) return;
      ev.innerHTML = '…';
      let C=[];
      try{ const r=await fetch(`${API_BASE}/calendar`,  {credentials:'same-origin'}); const data=await r.json(); C = Array.isArray(data)? data.filter(x=> (x.start_at||'').startsWith(todayISO())):[]; }catch{}
      const fill = (ul, arr, empty)=>{ ul.innerHTML = arr.length? '' : `<li class="muted">${empty}</li>`;
        arr.slice(0,6).forEach(x=>{
          const li=document.createElement('li');
          const time = x.start_at? fmtTime(x.start_at):'';
          li.innerHTML=`<span>${x.title||''}</span><span class="due">${time}</span>`;
          ul.appendChild(li);
        });
      };
      fill(ev,  C, 'Событий нет');
    }
    if (key==='notes'){
      // no preload; wait for user input
    }
  }

  // Quick note save
  const saveBtn = q('#wNoteSave');
  if (saveBtn){
    saveBtn.addEventListener('click', async ()=>{
      const ta = q('#wNoteText');
      const text = (ta && ta.value || '').trim(); if (!text) return;
      try{
        await fetch(`${API_BASE}/notes`, {
          method:'POST', credentials:'same-origin',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ content: text })
        });
      }catch{}
      if (ta) ta.value='';
      const dlg = saveBtn.closest('dialog'); try { dlg && dlg.close(); } catch { dlg && dlg.removeAttribute('open'); }
    });
  }
})();


// Profile dropdown: robust, accessible, no persisted state
(function initProfileMenu(){
  const btn = document.getElementById('profileBtn');
  const menu = document.getElementById('profileMenu');
  if (!btn || !menu) return;

  let open = false;
  const openMenu = () => {
    if (open) return;
    open = true;
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden','false');
    btn.setAttribute('aria-expanded','true');
    const focusable = menu.querySelector('a,button,[tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus({preventScroll:true});
  };
  const closeMenu = () => {
    if (!open) return;
    open = false;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden','true');
    btn.setAttribute('aria-expanded','false');
  };

  try {
    ['profileMenu','profileMenuOpen'].forEach(k => localStorage.removeItem(k));
  } catch(_){ }

  // initial state
  closeMenu();

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    open ? closeMenu() : openMenu();
  });
  menu.addEventListener('click', (e) => { e.stopPropagation(); });

  const onDocClick = (e) => {
    if (!open) return;
    const t = e.target;
    if (t === btn || btn.contains(t) || menu.contains(t)) return;
    closeMenu();
  };
  document.addEventListener('click', onDocClick);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
  window.addEventListener('scroll', closeMenu, {passive:true});
  window.addEventListener('resize', closeMenu, {passive:true});
  window.addEventListener('pageshow', () => closeMenu());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') closeMenu(); });
})();
