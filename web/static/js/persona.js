import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { personaDefaults } from './constants/personaDefaults';
const memory = {};
function build(entries, locale) {
    var _a, _b, _c, _d, _e, _f;
    const fall = 'ru';
    const codes = ['single', 'multiplayer', 'moderator', 'admin'];
    const result = {};
    for (const code of codes) {
        const key = (field) => `ui.persona.${code}.${field}.${locale}`;
        const fallKey = (field) => `ui.persona.${code}.${field}.${fall}`;
        result[code] = {
            label: (_b = (_a = entries[key('label')]) !== null && _a !== void 0 ? _a : entries[fallKey('label')]) !== null && _b !== void 0 ? _b : personaDefaults[fall][code].label,
            tooltipMd: (_d = (_c = entries[key('tooltip_md')]) !== null && _c !== void 0 ? _c : entries[fallKey('tooltip_md')]) !== null && _d !== void 0 ? _d : personaDefaults[fall][code].tooltipMd,
            slogan: (_f = (_e = entries[key('slogan')]) !== null && _e !== void 0 ? _e : entries[fallKey('slogan')]) !== null && _f !== void 0 ? _f : personaDefaults[fall][code].slogan
        };
    }
    return result;
}
export async function loadPersonaTexts(locale) {
    const cacheKey = `persona-texts:${locale}:v1`;
    const now = Date.now();
    const mem = memory[cacheKey];
    if (mem && mem.exp > now)
        return mem.data;
    try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
            const cached = JSON.parse(raw);
            if (cached.exp > now) {
                memory[cacheKey] = cached;
                return cached.data;
            }
        }
    }
    catch { }
    try {
        if (process.env.USE_REMOTE_APP_SETTINGS === 'false')
            throw new Error('offline');
        const resp = await fetch(`/api/v1/app-settings?prefix=ui.persona.`);
        if (resp.ok) {
            const json = await resp.json();
            const data = build(json.entries, locale);
            const wrapped = { data, exp: now + 60000 };
            memory[cacheKey] = wrapped;
            sessionStorage.setItem(cacheKey, JSON.stringify(wrapped));
            return data;
        }
    }
    catch { }
    const data = personaDefaults[locale] || personaDefaults.ru;
    const wrapped = { data, exp: now + 60000 };
    memory[cacheKey] = wrapped;
    return data;
}
// React components (lightweight)
import { useEffect, useState } from 'react';
function renderMarkdown(md) {
    const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    const out = [];
    let lastIndex = 0;
    let match;
    while ((match = re.exec(md)) !== null) {
        if (match.index > lastIndex)
            out.push(md.slice(lastIndex, match.index));
        out.push(_jsx("a", { href: match[2], target: "_blank", rel: "noopener noreferrer", children: match[1] }));
        lastIndex = re.lastIndex;
    }
    if (lastIndex < md.length)
        out.push(md.slice(lastIndex));
    return out;
}
export function PersonaHeader({ role, fullName, locale }) {
    const [texts, setTexts] = useState(null);
    const [open, setOpen] = useState(false);
    useEffect(() => { loadPersonaTexts(locale).then(setTexts); }, [locale]);
    if (!texts)
        return null;
    const entry = texts[role];
    const short = fullName.length > 24 ? fullName.slice(0, 24) + '…' : fullName;
    const id = 'persona-pop';
    return (_jsxs("div", { className: "persona-header", children: [_jsx("span", { className: "persona-badge", tabIndex: 0, "aria-haspopup": "dialog", "aria-describedby": id, onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false), onFocus: () => setOpen(true), onBlur: () => setOpen(false), children: entry.label }), _jsx("span", { className: "persona-name", children: short }), open && (_jsxs("div", { id: id, role: "dialog", className: "persona-popover", children: [_jsx("strong", { children: fullName }), _jsx("div", { children: renderMarkdown(entry.tooltipMd) }), _jsx("div", { className: "muted", children: entry.slogan })] }))] }));
}
export function StickySlogan({ code, locale }) {
    const [texts, setTexts] = useState(null);
    useEffect(() => { loadPersonaTexts(locale).then(setTexts); }, [locale]);
    if (!texts)
        return null;
    const entry = texts[code];
    return (_jsx("div", { style: { position: 'sticky', top: 0, backdropFilter: 'blur(6px)' }, "data-testid": "sticky-slogan", children: entry.slogan }));
}
