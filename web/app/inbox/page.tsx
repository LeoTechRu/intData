import PageLayout from '../../components/PageLayout';
import InboxTable from '../../components/InboxTable';

const MODULE_TITLE = 'Входящие';
const MODULE_DESCRIPTION =
  'Быстрые заметки из бота и веб-форм — отсюда их можно распределять по Areas и Projects.';

export default function InboxPage() {
  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION}>
      <InboxTable />
    </PageLayout>
  );
}
