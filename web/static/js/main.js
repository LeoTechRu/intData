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
