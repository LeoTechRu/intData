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
    document.addEventListener('click', () => {
        dropdown.classList.add('hidden');
    });
}
document.addEventListener('DOMContentLoaded', () => {
    enableAccessibility();
    initProfileMenu();
});
