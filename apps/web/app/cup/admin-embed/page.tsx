import type { Metadata } from 'next';

import { AdminDashboard } from '../../../components/admin';

export const metadata: Metadata = {
  title: 'Админский сектор — Intelligent Data Pro',
  description: 'Управляйте пользователями, Telegram-группами и настройками платформы в едином интерфейсе.',
};

export default function AdminEmbedPage() {
  return (
    <div className="min-h-screen bg-[var(--surface-1,#f4f5fb)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border border-subtle bg-[var(--surface-0)] p-6 shadow-soft">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Админский сектор</h1>
          <p className="mt-2 text-sm text-muted">
            Полный набор инструментов для администраторов: роль пользователей, Telegram‑группы, брендовые настройки,
            перезапуск сервисов и аудит.
          </p>
        </header>
        <AdminDashboard />
      </div>
    </div>
  );
}
