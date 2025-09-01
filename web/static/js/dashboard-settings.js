document.addEventListener('DOMContentLoaded', async () => {
  const dashForm = document.getElementById('dashboard-settings-form');
  const favForm = document.getElementById('favorites-settings-form');
  if (!dashForm && !favForm) return;

  let layout = { v: 1, layouts: {}, hidden: [] };
  let favorites = { v: 1, items: [] };
  try {
    const resp = await fetch('/api/v1/user/settings?keys=dashboard_layout,favorites', {
      credentials: 'same-origin'
    });
    if (resp.ok) {
      const data = await resp.json();
      // Merge with defaults to avoid missing keys
      layout = Object.assign({ v: 1, layouts: {}, hidden: [] }, data.dashboard_layout || {});
      favorites = Object.assign({ v: 1, items: [] }, data.favorites || {});
    }
  } catch {}

  if (dashForm) {
    dashForm.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = !layout.hidden.includes(input.name);
    });

    dashForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const hidden = [];
      dashForm.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        if (!input.checked) hidden.push(input.name);
      });
      layout.hidden = hidden;
      if (typeof layout.layouts !== 'object') layout.layouts = {};
      try {
        await fetch('/api/v1/user/settings/dashboard_layout', {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: layout })
        });
      } catch (err) {
        console.error('save failed', err);
      }
      const msg = document.createElement('div');
      msg.className = 'muted';
      msg.textContent = 'Сохранено';
      dashForm.appendChild(msg);
      setTimeout(() => msg.remove(), 2000);
    });
  }

  if (favForm) {
    favForm.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      const path = input.name;
      // If no favorites saved yet, select all by default
      input.checked =
        favorites.items.length === 0 || favorites.items.some((it) => it.path === path);
    });

    favForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const items = [];
      favForm.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        if (input.checked) {
          const path = input.name;
          const label = input.dataset.label || path;
          items.push({ label, path, position: items.length + 1 });
        }
      });
      favorites.items = items;
      try {
        await fetch('/api/v1/user/settings/favorites', {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: favorites })
        });
      } catch (err) {
        console.error('save failed', err);
      }
      const msg = document.createElement('div');
      msg.className = 'muted';
      msg.textContent = 'Сохранено';
      favForm.appendChild(msg);
      setTimeout(() => msg.remove(), 2000);
    });
  }
});

