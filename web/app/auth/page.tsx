import type { Metadata } from 'next';

import AuthLanding from '../../components/auth/AuthLanding';

export const metadata: Metadata = {
  title: 'Intelligent Data Pro — вход и регистрация',
  description:
    'Зарегистрируйтесь в Intelligent Data Pro и получите доступ к PARA, календарю, привычкам и дашборду «Сегодня» бесплатно. Современный лендинг с ценностью продукта до авторизации.',
};

type AuthSearchParams = Record<string, string | string[] | undefined>;

interface AuthPageProps {
  searchParams?: Promise<AuthSearchParams>;
}

function pickParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function decodeBase64Record(value: string | null): Record<string, string> | null {
  if (!value) {
    return null;
  }
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
    const decoded = Buffer.from(padded, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, string>;
    }
  } catch (error) {
    console.warn('auth/page.tsx: не удалось декодировать base64 параметр', error);
  }
  return null;
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const resolved = (searchParams ? await searchParams : undefined) ?? {};
  const tab = pickParam(resolved.tab);
  const flash = pickParam(resolved.flash);
  const redirect = pickParam(resolved.redirect);
  const next = pickParam(resolved.next);
  const values = decodeBase64Record(pickParam(resolved.values));
  const errors = decodeBase64Record(pickParam(resolved.errors));

  return (
    <AuthLanding
      initialTab={tab}
      initialFlash={flash}
      initialValues={values}
      initialErrors={errors}
      redirectHint={redirect}
      nextUrl={next}
    />
  );
}
