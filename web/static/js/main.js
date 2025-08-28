// Example TypeScript entry point with modular structure
export function enableAccessibility() {
    const btn = document.getElementById('accessibility-toggle');
    if (!btn)
        return;
    btn.addEventListener('click', () => {
        document.documentElement.classList.toggle('high-contrast');
    });
}
export function initProfileMenu() {
    const button = document.getElementById('profile-button');
    const dropdown = document.getElementById('profile-dropdown');
    if (!button || !dropdown)
        return;
    button.addEventListener('click', (ev) => {
        ev.stopPropagation();
        dropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', (ev) => {
        if (!dropdown.contains(ev.target) && ev.target !== button) {
            dropdown.classList.add('hidden');
        }
    });
    dropdown.addEventListener('click', async (ev) => {
        const target = ev.target;
        const link = target === null || target === void 0 ? void 0 : target.closest('a');
        if (!link)
            return;
        const method = link.dataset.method;
        if (method && method.toUpperCase() !== 'GET') {
            ev.preventDefault();
            const resp = await fetch(link.href, { method, credentials: 'include' });
            if (resp.redirected) {
                window.location.href = resp.url;
            }
            else if (resp.ok) {
                window.location.reload();
            }
        }
        dropdown.classList.add('hidden');
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
    initProfileMenu();
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

// ===== Header responsive (2/3 rule) =====
(function(){
  const header = document.querySelector('.app-header');
  const nav = document.querySelector('.app-nav');
  const hamb = document.getElementById('navHamburger');
  const drawer = document.getElementById('navDrawer');
  if (!header || !nav || !hamb || !drawer) return;

  function collapseCheck(){
    const avail = header.clientWidth;
    const navW  = nav.scrollWidth;
    const limit = avail * 2/3;
    const needCollapse = navW > limit;
    header.classList.toggle('header-collapsed', needCollapse);
    hamb.hidden = !needCollapse;
    if (!needCollapse){ drawer.hidden = true; }
  }
  try { new ResizeObserver(collapseCheck).observe(header); } catch(e) { window.addEventListener('resize', collapseCheck); }
  window.addEventListener('load', collapseCheck);

  hamb.addEventListener('click', ()=>{
    const list = nav.querySelector('.nav-list');
    if (!list) return;
    drawer.innerHTML = '';
    const clone = list.cloneNode(true);
    clone.querySelectorAll('a').forEach(a=>a.classList.remove('is-active'));
    drawer.appendChild(clone);
    drawer.hidden = !drawer.hidden;
  });
  document.addEventListener('click', (e)=>{
    if (drawer.hidden) return;
    if (!drawer.contains(e.target) && !hamb.contains(e.target)) drawer.hidden = true;
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
