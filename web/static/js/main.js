// Example TypeScript entry point with modular structure
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
document.addEventListener('DOMContentLoaded', () => {
    enableAccessibility();
    initProfileEditForm();
    initDashboardCompact();
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

// ui2: role help modal (idempotent)
(function(){
  const ROLE_HELP = {
    admin: 'Админ: полные права администрирования.',
    moderator: 'Модератор: управление контентом/группами.',
    multiplayer: 'Совместная работа: доступ к групповым функциям.',
    single: 'Обычный пользователь: индивидуальный режим.',
    ban: 'Заблокирован: доступ к приложению закрыт. Напишите администратору.'
  };

  function ensureModal(){
    if (document.getElementById('role-help-modal')) return;
    const wrap = document.createElement('div');
    wrap.id = 'role-help-modal';
    wrap.className = 'role-help-modal hidden';
    wrap.innerHTML = `
      <div class="role-help-card">
        <div class="title">Роль пользователя</div>
        <div class="text" id="role-help-text"></div>
        <div class="actions"><button id="role-help-close" class="button">Понятно</button></div>
      </div>`;
    wrap.addEventListener('click', (e)=>{ if (!e.target.closest('.role-help-card')) hide(); });
    document.body.appendChild(wrap);
    document.getElementById('role-help-close').addEventListener('click', hide);
    document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') hide(); });
  }

  function show(role){
    ensureModal();
    const wrap = document.getElementById('role-help-modal');
    document.getElementById('role-help-text').textContent =
      ROLE_HELP[role] || `Роль: ${role}`;
    wrap.classList.remove('hidden');
  }
  function hide(){
    const wrap = document.getElementById('role-help-modal');
    if (wrap) wrap.classList.add('hidden');
  }

  function onClick(e){
    const b = e.target.closest('[data-role]');
    if (!b) return;
    e.preventDefault();
    show((b.dataset.role || '').trim());
  }

  document.addEventListener('click', onClick);
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

    const r = await fetch('/api/v1/notes', {
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

// auth: tab switcher on /auth
(function(){
const tabs = Array.from(document.querySelectorAll('.auth-tabs .tab'));
const forms = {
login: document.querySelector('.form-login'),
register: document.querySelector('.form-register'),
restore: document.querySelector('.form-restore'),
};
if (!tabs.length || !forms.login) return;

function activate(name){
Object.keys(forms).forEach(k=>{
forms[k]?.classList.toggle('is-hidden', k!==name);
});
tabs.forEach(t=>{
t.classList.toggle('is-active', t.dataset.tab===name);
t.setAttribute('aria-selected', String(t.dataset.tab===name));
});
// для закладки и глубоких ссылок
if (location.hash !== '#'+name) history.replaceState(null,'','#'+name);
}

// клики по табам
document.addEventListener('click', (e)=>{
const t = e.target.closest('.auth-tabs .tab');
const j = e.target.closest('[data-tab-jump]');
if (t){ e.preventDefault(); activate(t.dataset.tab); }
if (j){ e.preventDefault(); activate(j.dataset.tabJump); }
});

// при загрузке из hash
const hash = (location.hash||'').replace('#','');
if (hash && forms[hash]) activate(hash); else activate('login');
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
        const r = await fetch('/api/v1/tasks', {credentials:'same-origin'});
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
      const rem = q('#wReminders'); const ev = q('#wEvents'); if (!rem || !ev) return;
      rem.innerHTML = ev.innerHTML = '…';
      let R=[], C=[];
      try{ const r=await fetch('/api/v1/reminders', {credentials:'same-origin'}); const data=await r.json(); R = Array.isArray(data)? data.filter(x=> (x.remind_at||'').startsWith(todayISO())):[]; }catch{}
      try{ const r=await fetch('/api/v1/calendar',  {credentials:'same-origin'}); const data=await r.json(); C = Array.isArray(data)? data.filter(x=> (x.start_at||'').startsWith(todayISO())):[]; }catch{}
      const fill = (ul, arr, empty)=>{ ul.innerHTML = arr.length? '' : `<li class="muted">${empty}</li>`;
        arr.slice(0,6).forEach(x=>{
          const li=document.createElement('li');
          const time = x.remind_at? fmtTime(x.remind_at) : (x.start_at? fmtTime(x.start_at):'');
          li.innerHTML=`<span>${x.title||x.message||''}</span><span class="due">${time}</span>`;
          ul.appendChild(li);
        });
      };
      fill(rem, R, 'Напоминаний нет');
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
        await fetch('/api/v1/notes', {
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

(function initFavorites(){
  const menu = document.getElementById('profileMenu');
  if (!menu) return;

  const favBox = menu.querySelector('[data-fav-box]');
  const toggle = document.getElementById('favToggle');
  if (!favBox && !toggle) return;

  const api = {
    list: () => fetch('/api/v1/user/favorites', {credentials:'include'}).then(r=>r.json()),
    add: (label, path) => fetch('/api/v1/user/favorites', {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({label, path})
    }),
    remove: (id) => fetch(`/api/v1/user/favorites/${id}`, {method:'DELETE', credentials:'include'})
  };

  let cache = [];

  function render(items){
    if(!favBox) return;
    favBox.innerHTML = '';
    if (!items || !items.length){
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'Избранное пусто';
      favBox.appendChild(li);
      return;
    }
    for (const it of items){
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = it.path;
      a.setAttribute('role','menuitem');
      a.textContent = it.label || it.path;
      li.appendChild(a);
      favBox.appendChild(li);
    }
  }

  function updateToggle(){
    if(!toggle) return;
    const path = toggle.dataset.path || location.pathname;
    const found = cache.find(it => it.path === path);
    if (found){
      toggle.textContent = '★';
      toggle.dataset.id = found.id;
      toggle.setAttribute('aria-label','Убрать из избранного');
    } else {
      toggle.textContent = '☆';
      toggle.dataset.id = '';
      toggle.setAttribute('aria-label','Добавить в избранное');
    }
  }

  if (toggle){
    api.list().then(items => { cache = items || []; updateToggle(); }).catch(()=>{});
    toggle.addEventListener('click', (e)=>{
      e.preventDefault();
      const id = toggle.dataset.id;
      const path = toggle.dataset.path || location.pathname;
      const label = toggle.dataset.label || document.title;
      if (id){
        api.remove(id).then(()=>{ cache = cache.filter(it => String(it.id) !== String(id)); updateToggle(); render(cache); }).catch(()=>{});
      } else {
        api.add(label, path).then(r=>{ if(r.status===409) return null; return r.json(); }).then(it=>{ if(it){ cache.push(it); updateToggle(); render(cache); } }).catch(()=>{});
      }
    });
  }

  const btn = document.getElementById('profileBtn');
  if (btn && favBox){
    btn.addEventListener('click', () => {
      if (menu.classList.contains('is-open')){
        api.list().then(items => { cache = items || []; render(cache); updateToggle(); }).catch(()=>render([]));
      }
    });
  }
})();
