document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('dashboard-settings-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const layout = { v: 1, hidden: [] };
    if (!fd.get('profile_card')) layout.hidden.push('profile_card');
    if (!fd.get('quick_note')) layout.hidden.push('quick_note');
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
    form.appendChild(msg);
    setTimeout(() => msg.remove(), 2000);
  });

  document.querySelectorAll('.hint-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.hint || '';
      const popup = document.createElement('div');
      popup.className = 'hint-popup';
      popup.textContent = text;
      document.body.appendChild(popup);
      const rect = btn.getBoundingClientRect();
      popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
      popup.style.left = `${rect.left + window.scrollX}px`;
      setTimeout(() => popup.remove(), 3000);
    });
  });
});
