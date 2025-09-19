'use client';

import PageLayout from '../../PageLayout';
import { Card, EmptyState, TermHint } from '../../ui';

const MODULE_TITLE = 'CRM · Аккаунты и участники';
const MODULE_DESCRIPTION =
  'Единый каталог клиентов и компаний. Контакт автоматически создаётся в users_web по email/телефону и связывается с Telegram-аккаунтом.';

export default function CRMAccountsModule() {
  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION} contentClassName="flex flex-col gap-6">
      <Card className="bg-surface-soft text-sm text-muted">
        <p>
          Аккаунты наследуют PARA-контекст (Area/Project) и связываются с заметками, решениями и сделками. Добавление клиента без пароля создаёт запись
          в users_web, чтобы при регистрации соединить данные автоматически.
        </p>
        <p className="mt-2">
          <TermHint
            label="Телефон и email"
            description="Если указан email или телефон, мы ищем существующую запись и объединяем данные. При совпадении с несколькими полями потребуется подтверждение."
          />
        </p>
      </Card>
      <EmptyState
        icon="📇"
        title="Скоро таблица аккаунтов"
        description="Сюда добавим фильтры по PARA, поиск по email/телефону и быстрые действия: создать сделку, отправить сообщение, открыть заметку."
      />
    </PageLayout>
  );
}
