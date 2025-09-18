'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { PUBLIC_CTA, PUBLIC_NAV, type PublicNavItem } from '../../lib/publicNav';
import { cn } from '../../lib/cn';

function isActive(pathname: string | null, item: PublicNavItem): boolean {
  if (!pathname || item.external) {
    return false;
  }
  if (pathname === item.href) {
    return true;
  }
  return pathname.startsWith(`${item.href}/`);
}

export function PublicHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/80 text-sm shadow-soft backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-6 py-5 md:px-10">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-2xl bg-[var(--accent-primary-soft)] px-4 py-2 font-semibold text-[var(--text-primary)] transition-base hover:bg-[var(--accent-primary)] hover:text-[var(--accent-on-primary)]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-base font-semibold text-[var(--accent-on-primary)] shadow-soft">
            ID
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span>Intelligent Data Pro</span>
            <span className="text-xs font-normal text-muted">Второй мозг для команд знаний</span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-4 text-[var(--text-primary)] text-xs sm:text-sm md:gap-5" aria-label="Основная навигация">
          {PUBLIC_NAV.map((item) => {
            const active = isActive(pathname, item);
            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'transition-base hover:text-[var(--accent-primary)]',
                    active && 'font-semibold text-[var(--accent-primary)] underline decoration-dotted underline-offset-4',
                  )}
                >
                  {item.label}
                </a>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'transition-base hover:text-[var(--accent-primary)]',
                  active && 'font-semibold text-[var(--accent-primary)] underline decoration-dotted underline-offset-4',
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href={PUBLIC_CTA.secondary.href}
            className="text-muted transition-base hover:text-[var(--accent-primary)]"
          >
            {PUBLIC_CTA.secondary.label}
          </Link>
        </nav>

        <Link
          href={PUBLIC_CTA.primary.href}
          className="ml-auto inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--accent-on-primary)] shadow-soft transition-base hover:opacity-90"
        >
          {PUBLIC_CTA.primary.label}
        </Link>
      </div>
    </header>
  );
}
