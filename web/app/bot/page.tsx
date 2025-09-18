import Link from 'next/link';
import type { Metadata } from 'next';

import BotLanding from '../../components/marketing/BotLanding';

export const metadata: Metadata = {
  title: 'Telegram-бот Intelligent Data Pro — быстрый захват и автоматизация PARA',
  description:
    'Публичный лендинг @intDataBot: сценарии захвата, контроль дедлайнов, наблюдатели и интеграция с PARA. Подключите Telegram-бот к Intelligent Data Pro за несколько минут.',
};

export const dynamic = 'force-static';

export default function BotPage() {
  const currentYear = new Date().getFullYear();
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eef2ff] via-[#f5f3ff] to-[#fff7ed] text-[var(--text-primary)]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-10">
        <Link href="/" className="group inline-flex items-center gap-3" prefetch={false}>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-primary)] text-lg font-semibold text-[var(--accent-on-primary)] shadow-soft">
            ID
          </span>
          <span className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight">Intelligent Data Pro</span>
            <span className="text-sm text-muted">PARA, Automations, Telegram</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
          <Link href="/docs" prefetch={false} className="transition-base hover:text-[var(--accent-primary)]">
            Документация
          </Link>
          <Link href="/tariffs" prefetch={false} className="transition-base hover:text-[var(--accent-primary)]">
            Тарифы
          </Link>
          <Link
            href="https://intdata.pro/bot"
            className="transition-base hover:text-[var(--accent-primary)]"
            target="_blank"
            rel="noreferrer"
          >
            Открыть @intDataBot
          </Link>
        </nav>
        <Link
          href="/auth"
          prefetch={false}
          className="hidden h-10 items-center rounded-full border border-subtle px-5 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition-base hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] md:flex"
        >
          Войти
        </Link>
      </header>

      <main className="px-6 pb-20 pt-6 md:px-10 lg:px-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-20">
          <BotLanding />
        </div>
      </main>

      <footer className="border-t border-white/60 bg-white/70 py-8 text-sm text-muted backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 md:flex-row md:items-center md:justify-between md:px-10">
          <span>© {currentYear} Intelligent Data Pro. Все права защищены.</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/docs" prefetch={false} className="transition-base hover:text-[var(--accent-primary)]">
              Документация
            </Link>
            <Link href="/tariffs" prefetch={false} className="transition-base hover:text-[var(--accent-primary)]">
              Тарифы
            </Link>
            <a
              href="mailto:hello@intdata.pro?subject=Вопрос%20по%20боту"
              className="transition-base hover:text-[var(--accent-primary)]"
            >
              Поддержка
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

