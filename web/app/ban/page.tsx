import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Доступ к приложению закрыт — Intelligent Data Pro',
  description:
    'Ваш аккаунт помечен как заблокированный. Обратитесь к администратору, если считаете это ошибкой.',
};

export default function BanPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface-1,#f4f5fb)] px-4 py-16">
      <div className="max-w-xl rounded-2xl border border-subtle bg-[var(--surface-0)] p-8 text-center shadow-soft">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Доступ к приложению закрыт</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Ваш аккаунт помечен статусом <strong className="font-semibold text-[var(--accent-primary)]">ban</strong>. Доступ к
          Intelligent Data Pro временно заблокирован.
        </p>
        <p className="mt-3 text-sm text-muted">
          Если вы считаете это ошибкой, обратитесь к администратору через
          <a
            href="https://t.me/leotechru"
            className="ml-1 inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
            rel="noreferrer noopener"
            target="_blank"
          >
            @leotechru
          </a>
          .
        </p>
        <p className="mt-6 text-xs text-muted">
          Вы всегда можете выйти из аккаунта и войти под другим пользователем.
        </p>
        <a
          href="/auth/logout"
          className="mt-6 inline-flex items-center justify-center rounded-full border border-[var(--accent-primary)] px-5 py-2 text-sm font-medium text-[var(--accent-primary)] transition-base hover:bg-[var(--accent-primary)] hover:text-white"
        >
          Выйти из аккаунта
        </a>
      </div>
    </div>
  );
}
