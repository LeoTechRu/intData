// Example TypeScript entry point with modular structure
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
  document.addEventListener('click', () => {
    dropdown.classList.add('hidden');
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

document.addEventListener('DOMContentLoaded', () => {
  enableAccessibility();
  initProfileMenu();
  initAdminMenu();
  initProfileEditForm();
});
