import type { ReactNode } from 'react';

import { PublicFooter } from '../../components/layout/PublicFooter';
import { PublicHeader } from '../../components/layout/PublicHeader';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#eef2ff] via-[#f5f3ff] to-[#fff7ed] text-[var(--text-primary)]">
      <PublicHeader />
      <main className="flex-1 px-6 pb-20 pt-6 md:px-10 lg:px-16">{children}</main>
      <PublicFooter />
    </div>
  );
}
