import type { Metadata } from 'next';

import TariffsLanding from '../../../components/marketing/TariffsLanding';

export const metadata: Metadata = {
  title: 'Тарифы Intelligent Data Pro — Solo, Team, Pro, Enterprise',
  description:
    'Лендинг тарифов Intelligent Data Pro: бесплатный Solo, командный Team, профессиональный Pro с CRM и Enterprise с white-label и self-hosting.',
};

export const dynamic = 'force-static';

export default function TariffsPage() {
  return <TariffsLanding />;
}
