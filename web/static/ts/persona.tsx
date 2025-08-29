import { personaDefaults } from './constants/personaDefaults';

export type PersonaCode = 'personal_brain' | 'collective_consciousness' | 'knowledge_keeper' | 'system_architect';

type Entry = { label: string; tooltip: string; slogan: string };
export type PersonaTexts = Record<PersonaCode, Entry>;

const memory: Record<string, { exp: number; data: PersonaTexts }> = {};

function build(entries: Record<string, string>, locale: string): PersonaTexts {
  const fall = 'ru';
  const codes: PersonaCode[] = ['personal_brain','collective_consciousness','knowledge_keeper','system_architect'];
  const result: any = {};
  for (const code of codes) {
    const key = (field: string) => `ui.persona.${code}.${field}.${locale}`;
    const fallKey = (field: string) => `ui.persona.${code}.${field}.${fall}`;
    result[code] = {
      label: entries[key('label')] ?? entries[fallKey('label')] ?? personaDefaults[fall][code].label,
      tooltip: entries[key('tooltip')] ?? entries[fallKey('tooltip')] ?? personaDefaults[fall][code].tooltip,
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

export function PersonaBadge({ code, locale }: { code: PersonaCode; locale: 'ru'|'en' }) {
  const [texts, setTexts] = useState<PersonaTexts | null>(null);
  useEffect(() => { loadPersonaTexts(locale).then(setTexts); }, [locale]);
  if (!texts) return null;
  const entry = texts[code];
  const id = `persona-tip-${code}`;
  return (
    <span className="persona-badge" aria-describedby={id}>
      {entry.label}
      <span id={id} role="tooltip" className="sr-only">{entry.tooltip}</span>
    </span>
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
