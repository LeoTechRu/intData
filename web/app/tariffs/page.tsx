import type { Metadata } from 'next';
import PageLayout from '../../components/PageLayout';
import TariffsLanding from '../../components/marketing/TariffsLanding';

const MODULE_TITLE = 'Тарифы Intelligent Data Pro';
const MODULE_DESCRIPTION =
  'Сравните планы для личной продуктивности, команд и корпоративных экосистем. Единая PARA-схема, режимы single/multiplayer и CRM-процессы в одном продукте.';
const MODULE_SUBTITLE = 'Готовые планы монетизации Intelligent Data Pro';

export const metadata: Metadata = {
  title: 'Тарифы Intelligent Data Pro — Solo, Team, Pro, Enterprise',
  description:
    'Лендинг тарифов Intelligent Data Pro: бесплатный Solo, командный Team, профессиональный Pro с CRM и Enterprise с white-label и self-hosting.',
};

export default function TariffsPage() {
  return (
    <PageLayout
      title={MODULE_TITLE}
      description={MODULE_DESCRIPTION}
      subtitle={MODULE_SUBTITLE}
      headingLevel={1}
      hideContentTitle
      contentClassName="px-0 pb-0 md:px-6 md:pb-0"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pb-16 pt-6 md:px-0">
        <TariffsLanding />
      </div>
    </PageLayout>
  );
}
