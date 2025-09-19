'use client';

import PageLayout from '../../PageLayout';
import { Card, EmptyState, TermHint } from '../../ui';

const MODULE_TITLE = 'CRM · Сделки';
const MODULE_DESCRIPTION =
  'Канбан и туннели продаж Intelligent Data Pro. Перетаскивайте сделки между стадиями, запускайте автоматизацию и связывайте решения через Zettelkasten.';

export default function CRMDealsModule() {
  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION} contentClassName="flex flex-col gap-6">
      <Card className="bg-surface-soft text-sm text-muted">
        <p>
          Модуль сделок подключает параллельные «туннели» (Bitrix24-style) и Zettelkasten-панель знаний. Здесь появится канбан с быстрыми
          действиями и наблюдением за автоматизациями.
        </p>
        <p className="mt-2">
          <TermHint
            label="Как будет работать"
            description="Сделки живут в парах pipeline/stage. Перетаскивание запускает автоматизации: сообщения, задачи, переводы пользователей между потоками продукта."
          />
        </p>
      </Card>
      <EmptyState
        icon="🛠️"
        title="Каркас в разработке"
        description="Следующим шагом подключим канбан по стадиям, настройку туннелей и панель знаний для карточки сделки."
      />
    </PageLayout>
  );
}
