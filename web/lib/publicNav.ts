export type PublicNavItem = {
  label: string;
  href: string;
  external?: boolean;
};

export const PUBLIC_NAV: PublicNavItem[] = [
  { label: 'Документация', href: '/docs' },
  { label: 'Тарифы', href: '/tariffs' },
  { label: 'Telegram‑бот', href: '/bot' },
];

export const PUBLIC_CTA = {
  primary: { label: 'Начать бесплатно', href: '/auth' },
  secondary: { label: 'Войти', href: '/auth?mode=login' },
} as const;
