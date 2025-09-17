import PageLayout from '../components/PageLayout';
import { OverviewDashboard } from '../components/dashboard';

const MODULE_TITLE = 'Обзор';
const MODULE_DESCRIPTION =
  'Цифровая рабочая среда Intelligent Data Pro: ключевые метрики, напоминания и команды в одном месте.';

export default function OverviewPage() {
  return (
    <PageLayout
      title={MODULE_TITLE}
      description={MODULE_DESCRIPTION}
      hideContentTitle
    >
      <OverviewDashboard />
    </PageLayout>
  );
}
