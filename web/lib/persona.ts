import { apiFetch } from './api';

export type PersonaRole = 'single' | 'multiplayer' | 'moderator' | 'admin';

export interface PersonaInfo {
  label: string;
  tooltipMd: string;
  slogan: string;
}

export type PersonaBundle = Record<PersonaRole, PersonaInfo>;

const DEFAULT_PERSONA_BUNDLE: PersonaBundle = {
  single: {
    label: 'Второй мозг',
    tooltipMd: 'Внешний контур памяти и мышления. [Что это?](https://intdata.pro/second-brain)',
    slogan: 'Работайте во «втором мозге».',
  },
  multiplayer: {
    label: 'Коллективное сознание',
    tooltipMd: 'Вы — часть общего знания.',
    slogan: 'Собираем знание вместе.',
  },
  moderator: {
    label: 'Хранитель знаний',
    tooltipMd: 'Поддерживайте порядок и ясность.',
    slogan: 'Помогаем команде понимать больше.',
  },
  admin: {
    label: 'Архитектор системы',
    tooltipMd: 'Вы задаёте правила платформы.',
    slogan: 'Создавайте опоры для всей системы.',
  },
};

const PERSONA_FIELDS: Array<keyof PersonaInfo> = ['label', 'tooltipMd', 'slogan'];

function buildPersonaBundle(
  entries: Record<string, string>,
  locale: string,
): PersonaBundle {
  const result: Partial<Record<PersonaRole, PersonaInfo>> = {};
  const roles: PersonaRole[] = ['single', 'multiplayer', 'moderator', 'admin'];

  roles.forEach((role) => {
    const defaults = DEFAULT_PERSONA_BUNDLE[role];
    const resolved: Partial<PersonaInfo> = {};

    PERSONA_FIELDS.forEach((field) => {
      const localisedKey = `ui.persona.${role}.${field}.${locale}`;
      const fallbackKey = `ui.persona.${role}.${field}.ru`;
      resolved[field] = entries[localisedKey] ?? entries[fallbackKey] ?? defaults[field];
    });

    result[role] = {
      label: resolved.label ?? defaults.label,
      tooltipMd: resolved.tooltipMd ?? defaults.tooltipMd,
      slogan: resolved.slogan ?? defaults.slogan,
    };
  });

  return result as PersonaBundle;
}

interface AppSettingsResponse {
  entries: Record<string, string>;
}

const PERSONA_ENDPOINT = '/api/v1/app-settings?prefix=ui.persona.';

export async function fetchPersonaBundle(locale = 'ru'): Promise<PersonaBundle> {
  try {
    const data = await apiFetch<AppSettingsResponse>(PERSONA_ENDPOINT, { skipAuth: false });
    return buildPersonaBundle(data.entries ?? {}, locale);
  } catch {
    return DEFAULT_PERSONA_BUNDLE;
  }
}

export function getPersonaInfo(bundle: PersonaBundle, role?: string | null): PersonaInfo {
  const normalized = (role ?? '').toLowerCase() as PersonaRole;
  if (normalized in bundle) {
    return bundle[normalized as PersonaRole];
  }
  return DEFAULT_PERSONA_BUNDLE.single;
}

export function getPreferredLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const [language] = navigator.language.split('-');
    return language || 'ru';
  }
  if (typeof document !== 'undefined') {
    const docLang = document.documentElement.lang;
    if (docLang) {
      const [language] = docLang.split('-');
      return language || 'ru';
    }
  }
  return 'ru';
}

export { DEFAULT_PERSONA_BUNDLE };
