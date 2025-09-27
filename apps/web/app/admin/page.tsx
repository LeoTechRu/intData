import AppShell from '../../components/AppShell';
import { AdminDashboard } from '../../components/admin';

const TITLE = 'ЛК Админа';
const SUBTITLE =
  'Центр управления рабочей областью: роли пользователей, Telegram-группы, брендовые настройки и сервисные операции.';

export default function AdminPage() {
  return (
    <AppShell title={TITLE} subtitle={SUBTITLE} contentVariant="flat">
      <AdminDashboard />
    </AppShell>
  );
}
