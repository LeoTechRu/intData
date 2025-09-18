import type { Metadata } from 'next';

import DocsLanding from '../../../components/marketing/DocsLanding';

export const metadata: Metadata = {
  title: 'Документация Intelligent Data Pro — PARA, Zettelkasten, геймификация',
  description:
    'Публичный портал Intelligent Data Pro: объясняем PARA и Zettelkasten, показываем геймификацию привычек и собираем исследования, подтверждающие эффект.',
};

export const dynamic = 'force-static';

export default function DocsPage() {
  return <DocsLanding />;
}
