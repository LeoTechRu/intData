import { personaDefaults } from './constants/personaDefaults';

export type PersonaCode = 'single' | 'multiplayer' | 'moderator' | 'admin';

type Entry = { label: string; tooltipMd: string; slogan: string };
export type PersonaTexts = Record<PersonaCode, Entry>;

const memory: Record<string, { exp: number; data: PersonaTexts }> = {};

function build(entries: Record<string, string>, locale: string): PersonaTexts {
  const fall = 'ru';
  const codes: PersonaCode[] = ['single','multiplayer','moderator','admin'];
  const result: any = {};
  for (const code of codes) {
    const key = (field: string) => `ui.persona.${code}.${field}.${locale}`;
    const fallKey = (field: string) => `ui.persona.${code}.${field}.${fall}`;
    result[code] = {
      label: entries[key('label')] ?? entries[fallKey('label')] ?? personaDefaults[fall][code].label,
      tooltipMd: entries[key('tooltip_md')] ?? entries[fallKey('tooltip_md')] ?? personaDefaults[fall][code].tooltipMd,
      slogan: entries[key('slogan')] ?? entries[fallKey('slogan')] ?? personaDefaults[fall][code].slogan
    };
  }
  return result as PersonaTexts;
}

export async function loadPersonaTexts(locale: 'ru'|'en'): Promise<PersonaTexts> {
  const cacheKey = `persona-texts:${locale}:v1`;
  const now = Date.now();
  const mem = memory[cacheKey];
  if (mem && mem.exp > now) return mem.data;
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached.exp > now) {
        memory[cacheKey] = cached;
        return cached.data;
      }
    }
  } catch {}
  try {
    if (process.env.USE_REMOTE_APP_SETTINGS === 'false') throw new Error('offline');
    const resp = await fetch(`/api/v1/app-settings?prefix=ui.persona.`);
    if (resp.ok) {
      const json = await resp.json();
      const data = build(json.entries, locale);
      const wrapped = { data, exp: now + 60000 };
      memory[cacheKey] = wrapped;
      sessionStorage.setItem(cacheKey, JSON.stringify(wrapped));
      return data;
    }
  } catch {}
  const data = personaDefaults[locale] || personaDefaults.ru;
  const wrapped = { data, exp: now + 60000 };
  memory[cacheKey] = wrapped;
  return data;
}

// React components (lightweight)
import React, { useEffect, useState } from 'react';

function renderMarkdown(md: string): React.ReactNode[] {
  const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(md)) !== null) {
    if (match.index > lastIndex) out.push(md.slice(lastIndex, match.index));
    out.push(<a href={match[2]} target="_blank" rel="noopener noreferrer">{match[1]}</a>);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < md.length) out.push(md.slice(lastIndex));
  return out;
}

export function PersonaHeader({ role, fullName, locale }: { role: PersonaCode; fullName: string; locale: 'ru'|'en' }) {
  const [texts, setTexts] = useState<PersonaTexts | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { loadPersonaTexts(locale).then(setTexts); }, [locale]);
  if (!texts) return null;
  const entry = texts[role];
  const short = fullName.length > 24 ? fullName.slice(0,24) + '…' : fullName;
  const id = 'persona-pop';
  return (
    <div className="persona-header">
      <span
        className="persona-badge"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {entry.label}
      </span>
      <span className="persona-name">{short}</span>
      {open && (
        <div id={id} role="dialog" className="persona-popover">
          <strong>{fullName}</strong>
          <div>{renderMarkdown(entry.tooltipMd)}</div>
          <div className="muted">{entry.slogan}</div>
        </div>
      )}
    </div>
  );
}

export function StickySlogan({ code, locale }: { code: PersonaCode; locale: 'ru'|'en' }) {
  const [texts, setTexts] = useState<PersonaTexts | null>(null);
  useEffect(() => { loadPersonaTexts(locale).then(setTexts); }, [locale]);
  if (!texts) return null;
  const entry = texts[code];
  return (
    <div style={{position:'sticky',top:0,backdropFilter:'blur(6px)'}} data-testid="sticky-slogan">
      {entry.slogan}
    </div>
  );
}
