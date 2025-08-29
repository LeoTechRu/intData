import React, { useEffect, useState, useMemo, useRef } from 'react';
import { loadPersonaBundle, type BackendRole } from '@/services/personaTexts';
import { renderSafeMd } from '@/utils/renderSafeMd';

type User = { full_name?: string; email?: string; nickname?: string; backendRole: BackendRole };
function shortName(u: User) { return u.full_name || u.nickname || u.email || 'Гость'; }

export default function PersonaHeader({ currentUser, locale='ru' }:{ currentUser: User; locale?: 'ru'|'en' }) {
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadPersonaBundle>> | null>(null);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { loadPersonaBundle(locale).then(setBundle); }, [locale]);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => { if (!btnRef.current) return;
      const pop = document.getElementById('persona-popover');
      if (open && pop && !pop.contains(e.target as Node) && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  const texts = useMemo(() => bundle ? bundle[currentUser.backendRole] : null, [bundle, currentUser.backendRole]);
  if (!texts) return null;

  return (
    <div className="persona-wrapper" style={{display:'flex',alignItems:'center',gap:8,marginLeft:12}}>
      <span className="persona-badge" style={{
        display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:999,
        fontSize:12, fontWeight:600, background:'#efe8ff', color:'#5a3ec8'
      }}>{texts.label}</span>

      <button
        ref={btnRef}
        onClick={() => setOpen(o=>!o)}
        className="persona-name"
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{background:'transparent',border:0,cursor:'pointer',fontSize:14,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:220}}
        title={shortName(currentUser)}
      >
        {shortName(currentUser)}
      </button>

      {open && (
        <div id="persona-popover" role="dialog" aria-label="Персонализация"
             style={{
               position:'absolute', top:'56px', /* под вашей шапкой уточните offset */
               left: '12px', zIndex: 1000, minWidth: 320,
               background:'#fff', border:'1px solid #eaeaea', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,.12)',
               padding:'12px 14px'
             }}>
          <div style={{fontWeight:700, marginBottom:6}}>{shortName(currentUser)}</div>
          <div style={{fontSize:13, lineHeight:1.35, marginBottom:8, color:'#444'}}>
            {renderSafeMd(texts.tooltipMd)}
          </div>
          <div style={{fontSize:12, color:'#666'}}>{texts.slogan}</div>
        </div>
      )}
    </div>
  );
}
