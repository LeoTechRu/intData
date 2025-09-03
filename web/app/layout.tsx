import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Intelligent Data Pro',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-50 text-gray-900">
        <header className="bg-accent1 text-white p-4 font-bold">Intelligent Data Pro</header>
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}
