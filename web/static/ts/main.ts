// Example TypeScript entry point with modular structure

import { API_BASE } from './services/apiBase.js';

const _origFetch = window.fetch;
window.fetch = async (input: RequestInfo, init: RequestInit = {}) => {
  const resp = await _origFetch(input, { ...init, redirect: 'manual' });
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
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.documentElement.classList.toggle('high-contrast');
  });
}

export function initProfileMenu() {
  const button = document.getElementById('profile-button');
  const dropdown = document.getElementById('profile-dropdown');
  const content = document.getElementById('main-content');
  if (!button || !dropdown || !content) return;
  button.addEventListener('click', (ev) => {
    ev.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', (ev) => {
    if (!dropdown.contains(ev.target as Node) && ev.target !== button) {
      dropdown.classList.add('hidden');
    }
  });
  dropdown.addEventListener('click', async (ev) => {
    const target = ev.target as HTMLElement | null;
    const link = target?.closest('a') as HTMLAnchorElement | null;
    if (!link) return;
    ev.preventDefault();
    const method = link.dataset.method || 'GET';
    const resp = await fetch(link.href, { method, credentials: 'include' });
    if (resp.redirected) {
      window.location.href = resp.url;
    } else if (resp.ok) {
      content.innerHTML = await resp.text();
      initProfileEditForm();
    }
    dropdown.classList.add('hidden');
  });
}

export function initDashboardCompact() {
  const button = document.getElementById('compact-toggle');
  if (!button) return;
  const body = document.body;
  const apply = (enabled: boolean) => {
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

export function initAdminMenu() {
  const button = document.getElementById('admin-button');
  const dropdown = document.getElementById('admin-dropdown');
  const content = document.getElementById('main-content');
  if (!button || !dropdown || !content) return;
  button.addEventListener('click', (ev) => {
    ev.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    dropdown.classList.add('hidden');
  });
  dropdown.addEventListener('click', async (ev) => {
    const target = ev.target as HTMLElement | null;
    const link = target?.closest('a') as HTMLAnchorElement | null;
    if (!link) return;
    ev.preventDefault();
    const url = link.dataset.adminEndpoint;
    if (!url) return;
    const resp = await fetch(url, { credentials: 'include' });
    if (resp.ok) {
      content.innerHTML = await resp.text();
      initProfileEditForm();
    }
    dropdown.classList.add('hidden');
  });
}

export function initProfileEditForm() {
  const form = document.getElementById('profile-edit-form') as HTMLFormElement | null;
  if (!form) return;
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

export async function loadUserSettings() {
  try {
    const resp = await fetch(
      `${API_BASE}/user/settings?keys=dashboard_layout,favorites`,
      { credentials: 'include' }
    );
    if (!resp.ok) return;
    const data = await resp.json();
    const favBox = document.querySelector('[data-fav-box]') as HTMLUListElement | null;
    if (favBox) {
      const items = (data.favorites?.items || []).sort(
        (a: any, b: any) => (a.position || 0) - (b.position || 0)
      );
      favBox.innerHTML = '';
      if (!items.length) {
        const li = document.createElement('li');
        li.className = 'muted';
        li.textContent = 'Избранное пусто';
        favBox.appendChild(li);
      } else {
        for (const it of items) {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = it.path;
          a.textContent = it.label || it.path;
          a.setAttribute('role', 'menuitem');
          li.appendChild(a);
          favBox.appendChild(li);
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

export async function saveDashboardLayout(layout: any) {
  await fetch(`${API_BASE}/user/settings/dashboard_layout`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ value: layout }),
  });
}

document.addEventListener('DOMContentLoaded', () => {
  enableAccessibility();
  initProfileMenu();
  initAdminMenu();
  initProfileEditForm();
  initDashboardCompact();
  loadUserSettings();
});
