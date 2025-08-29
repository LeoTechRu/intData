import { personaDefaults } from './constants/personaDefaults';
const memory = {};
function build(entries, locale) {
    var _a, _b, _c, _d, _e, _f;
    const fall = 'ru';
    const codes = ['personal_brain', 'collective_consciousness', 'knowledge_keeper', 'system_architect'];
    const result = {};
    for (const code of codes) {
        const key = (field) => `ui.persona.${code}.${field}.${locale}`;
        const fallKey = (field) => `ui.persona.${code}.${field}.${fall}`;
        result[code] = {
            label: (_b = (_a = entries[key('label')]) !== null && _a !== void 0 ? _a : entries[fallKey('label')]) !== null && _b !== void 0 ? _b : personaDefaults[fall][code].label,
            tooltip: (_d = (_c = entries[key('tooltip')]) !== null && _c !== void 0 ? _c : entries[fallKey('tooltip')]) !== null && _d !== void 0 ? _d : personaDefaults[fall][code].tooltip,
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
export function PersonaBadge({ code, locale }) {
    const [texts, setTexts] = useState(null);
    useEffect(() => { loadPersonaTexts(locale).then(setTexts); }, [locale]);
    if (!texts)
        return null;
    const entry = texts[code];
    const id = `persona-tip-${code}`;
    return className = "persona-badge";
    aria - describedby;
    {
        id;
    }
     >
        { entry, : .label }
        < span;
    id = { id };
    role = "tooltip";
    className = "sr-only" > { entry, : .tooltip } < /span>
        < /span>;
    ;
}
export function StickySlogan({ code, locale }) {
    const [texts, setTexts] = useState(null);
    useEffect(() => { loadPersonaTexts(locale).then(setTexts); }, [locale]);
    if (!texts)
        return null;
    const entry = texts[code];
    return style = {};
    {
        position: 'sticky', top;
        0, backdropFilter;
        'blur(6px)';
    }
}
data - testid;
"sticky-slogan" >
    { entry, : .slogan }
    < /div>;
;
