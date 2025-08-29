import { API_BASE } from './apiBase';

export type BackendRole = 'single'|'multiplayer'|'moderator'|'admin';
export type PersonaBundle = Record<BackendRole, { label: string; tooltipMd: string; slogan: string }>;

const DEFAULTS_RU: PersonaBundle = {
  single:      { label:'Второй мозг', tooltipMd:'Внешний контур памяти и мышления. [Что это?](https://intdata.pro/second-brain)', slogan:'Работайте во «втором мозге».', },
  multiplayer: { label:'Коллективное сознание', tooltipMd:'Вы — часть общего знания.', slogan:'Собираем знание вместе.', },
  moderator:   { label:'Хранитель знаний', tooltipMd:'Поддерживайте порядок и ясность.', slogan:'Помогаем команде понимать больше.', },
  admin:       { label:'Архитектор системы', tooltipMd:'Вы задаёте правила платформы.', slogan:'Создавайте опоры для всей системы.', },
};

function buildFromEntries(entries: Record<string,string>, locale: 'ru'|'en'): PersonaBundle {
  const read = (r: BackendRole, f:'label'|'tooltip_md'|'slogan') =>
    entries[`ui.persona.${r}.${f}.${locale}`] ?? entries[`ui.persona.${r}.${f}.ru`] ?? '';
  const b: PersonaBundle = {
    single:      { label: read('single','label'),      tooltipMd: read('single','tooltip_md'),      slogan: read('single','slogan') },
    multiplayer: { label: read('multiplayer','label'), tooltipMd: read('multiplayer','tooltip_md'), slogan: read('multiplayer','slogan') },
    moderator:   { label: read('moderator','label'),   tooltipMd: read('moderator','tooltip_md'),   slogan: read('moderator','slogan') },
    admin:       { label: read('admin','label'),       tooltipMd: read('admin','tooltip_md'),       slogan: read('admin','slogan') },
  };
  (Object.keys(b) as BackendRole[]).forEach(r => {
    (['label','tooltipMd','slogan'] as const).forEach(k => { if (!b[r][k]) b[r][k] = DEFAULTS_RU[r][k]; });
  });
  return b;
}

export async function loadPersonaBundle(locale: 'ru'|'en'): Promise<PersonaBundle> {
  const key = `persona-texts:${locale}:v1`;
  const cached = sessionStorage.getItem(key);
  if (cached) return JSON.parse(cached) as PersonaBundle;
  try {
    const res = await fetch(`${API_BASE}/app-settings?prefix=ui.persona.`);
    const { entries } = await res.json();
    const data = buildFromEntries(entries, locale);
    sessionStorage.setItem(key, JSON.stringify(data));
    return data;
  } catch {
    return DEFAULTS_RU;
  }
}
