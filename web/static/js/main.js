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
    const content = document.getElementById('main-content');
    if (!button || !dropdown || !content)
        return;
    button.addEventListener('click', (ev) => {
        ev.stopPropagation();
        dropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
        dropdown.classList.add('hidden');
    });
    dropdown.addEventListener('click', async (ev) => {
        const target = ev.target;
        const link = target === null || target === void 0 ? void 0 : target.closest('a');
        if (!link)
            return;
        ev.preventDefault();
        const resp = await fetch(link.href);
        if (resp.ok) {
            content.innerHTML = await resp.text();
        }
        dropdown.classList.add('hidden');
    });
}
export function initAdminPanel() {
    const panel = document.querySelector('.admin-panel');
    const content = document.getElementById('main-content');
    if (!panel || !content)
        return;
    panel.addEventListener('click', async (ev) => {
        const target = ev.target;
        const link = target === null || target === void 0 ? void 0 : target.closest('a');
        if (!link)
            return;
        ev.preventDefault();
        const url = link.dataset.adminEndpoint;
        if (!url)
            return;
        const resp = await fetch(url);
        if (resp.ok) {
            content.innerHTML = await resp.text();
        }
    });
}
document.addEventListener('DOMContentLoaded', () => {
    enableAccessibility();
    initProfileMenu();
    initAdminPanel();
});
