import SettingsModule from '../../components/settings/SettingsModule';
import PageLayout from '../../components/PageLayout';

const MODULE_TITLE = 'Настройки';
const MODULE_DESCRIPTION =
  'Персонализируйте рабочее пространство: настройте дашборд, меню, тему и административные параметры.';

export default function SettingsPage() {
  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION}>
      <SettingsModule />
    </PageLayout>
  );
}
