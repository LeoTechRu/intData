import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Intelligent Data Pro',
  description: 'ЦУП и инструменты PARA для управления знаниями, временем и привычками.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" data-theme="light">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
