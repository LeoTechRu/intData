'use client';

import PageLayout from '../../PageLayout';
import { Card, EmptyState, TermHint } from '../../ui';

const MODULE_TITLE = 'CRM · Аналитика';
const MODULE_DESCRIPTION =
  'Пульс воронки и покрытия знаний: конверсия по стадиям, переходы между потоками, доля сделок с заметками Zettelkasten.';

export default function CRMAnalyticsModule() {
  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION} contentClassName="flex flex-col gap-6">
      <Card className="bg-surface-soft text-sm text-muted">
        <p>
          Дашборд CRM собирает метрики «Pipeline Health», «Knowledge Coverage» и динамику переходов между тарифами/потоками. Виджеты будут использовать
          React Query и кэширование, чтобы не тормозить при переключении фильтров.
        </p>
        <p className="mt-2">
          <TermHint
            label="Zettelkasten coverage"
            description="Показывает, сколько сделок имеют связанные заметки/решения. Это помогает следить за полнотой знаний и ретроспектив."
          />
        </p>
      </Card>
      <EmptyState
        icon="📊"
        title="В разработке"
        description="После подключения API добавим графики, сводку автоматизаций и экспорт в Data Hub."
      />
    </PageLayout>
  );
}
