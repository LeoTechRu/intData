import Link from 'next/link';

import { PUBLIC_NAV } from '../../lib/publicNav';

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/60 bg-white/80 text-sm text-muted backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-10">
        <div className="flex flex-wrap items-center gap-4" aria-label="Footer навигация">
          {PUBLIC_NAV.map((item) =>
            item.external ? (
              <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className="transition-base hover:text-[var(--accent-primary)]">
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className="transition-base hover:text-[var(--accent-primary)]">
                {item.label}
              </Link>
            ),
          )}
          <a href="https://t.me/intDataHELP" target="_blank" rel="noreferrer" className="transition-base hover:text-[var(--accent-primary)]">
            Поддержка
          </a>
        </div>
        <div className="text-xs uppercase tracking-wide text-muted/80">© {currentYear} Intelligent Data Pro</div>
      </div>
    </footer>
  );
}
