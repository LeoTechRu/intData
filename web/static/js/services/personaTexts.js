import { API_BASE } from './apiBase.js';

const DEFAULTS_RU = {
    single: { label: 'Второй мозг', tooltipMd: 'Внешний контур памяти и мышления. [Что это?](https://intdata.pro/second-brain)', slogan: 'Работайте во «втором мозге».', },
    multiplayer: { label: 'Коллективное сознание', tooltipMd: 'Вы — часть общего знания.', slogan: 'Собираем знание вместе.', },
    moderator: { label: 'Хранитель знаний', tooltipMd: 'Поддерживайте порядок и ясность.', slogan: 'Помогаем команде понимать больше.', },
    admin: { label: 'Архитектор системы', tooltipMd: 'Вы задаёте правила платформы.', slogan: 'Создавайте опоры для всей системы.', },
};
function buildFromEntries(entries, locale) {
    const read = (r, f) => { var _a, _b; return (_b = (_a = entries[`ui.persona.${r}.${f}.${locale}`]) !== null && _a !== void 0 ? _a : entries[`ui.persona.${r}.${f}.ru`]) !== null && _b !== void 0 ? _b : ''; };
    const b = {
        single: { label: read('single', 'label'), tooltipMd: read('single', 'tooltip_md'), slogan: read('single', 'slogan') },
        multiplayer: { label: read('multiplayer', 'label'), tooltipMd: read('multiplayer', 'tooltip_md'), slogan: read('multiplayer', 'slogan') },
        moderator: { label: read('moderator', 'label'), tooltipMd: read('moderator', 'tooltip_md'), slogan: read('moderator', 'slogan') },
        admin: { label: read('admin', 'label'), tooltipMd: read('admin', 'tooltip_md'), slogan: read('admin', 'slogan') },
    };
    Object.keys(b).forEach(r => {
        ['label', 'tooltipMd', 'slogan'].forEach(k => { if (!b[r][k])
            b[r][k] = DEFAULTS_RU[r][k]; });
    });
    return b;
}
export async function loadPersonaBundle(locale) {
    const key = `persona-texts:${locale}:v1`;
    const cached = sessionStorage.getItem(key);
    if (cached)
        return JSON.parse(cached);
    try {
        const res = await fetch(`${API_BASE}/app-settings?prefix=ui.persona.`);
        const { entries } = await res.json();
        const data = buildFromEntries(entries, locale);
        sessionStorage.setItem(key, JSON.stringify(data));
        return data;
    }
    catch {
        return DEFAULTS_RU;
    }
}
