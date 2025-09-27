import PageLayout from '../../components/PageLayout';
import RemindersModule from '../../components/reminders/RemindersModule';

const MODULE_TITLE = 'Напоминания';
const MODULE_DESCRIPTION = 'Единый центр управления уведомлениями по задачам, календарю и CRM-интеграциям.';

export default function RemindersPage() {
  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION} hideContentTitle={false}>
      <RemindersModule />
    </PageLayout>
  );
}
