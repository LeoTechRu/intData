import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useMemo, useRef } from 'react';
import { loadPersonaBundle } from '@/services/personaTexts';
import { renderSafeMd } from '@/utils/renderSafeMd';
function shortName(u) { return u.full_name || u.nickname || u.email || 'Гость'; }
export default function PersonaHeader({ currentUser, locale = 'ru' }) {
    const [bundle, setBundle] = useState(null);
    const [open, setOpen] = useState(false);
    const btnRef = useRef(null);
    useEffect(() => { loadPersonaBundle(locale).then(setBundle); }, [locale]);
    useEffect(() => {
        const onDocClick = (e) => {
            if (!btnRef.current)
                return;
            const pop = document.getElementById('persona-popover');
            if (open && pop && !pop.contains(e.target) && !btnRef.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, [open]);
    const texts = useMemo(() => bundle ? bundle[currentUser.backendRole] : null, [bundle, currentUser.backendRole]);
    if (!texts)
        return null;
    return (_jsxs("div", { className: "persona-wrapper", style: { display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }, children: [_jsx("span", { className: "persona-badge", style: {
                    display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999,
                    fontSize: 12, fontWeight: 600, background: '#efe8ff', color: '#5a3ec8'
                }, children: texts.label }), _jsx("button", { ref: btnRef, onClick: () => setOpen(o => !o), className: "persona-name", "aria-haspopup": "dialog", "aria-expanded": open, style: { background: 'transparent', border: 0, cursor: 'pointer', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }, title: shortName(currentUser), children: shortName(currentUser) }), open && (_jsxs("div", { id: "persona-popover", role: "dialog", "aria-label": "\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F", style: {
                    position: 'absolute', top: '56px', /* под вашей шапкой уточните offset */
                    left: '12px', zIndex: 1000, minWidth: 320,
                    background: '#fff', border: '1px solid #eaeaea', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                    padding: '12px 14px'
                }, children: [_jsx("div", { style: { fontWeight: 700, marginBottom: 6 }, children: shortName(currentUser) }), _jsx("div", { style: { fontSize: 13, lineHeight: 1.35, marginBottom: 8, color: '#444' }, children: renderSafeMd(texts.tooltipMd) }), _jsx("div", { style: { fontSize: 12, color: '#666' }, children: texts.slogan })] }))] }));
}
