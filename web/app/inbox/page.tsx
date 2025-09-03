import PageLayout from '../../components/PageLayout';
import InboxTable from '../../components/InboxTable';

const MODULE_TITLE = 'Входящие';

export default function InboxPage() {
  return (
    <PageLayout title={MODULE_TITLE}>
      <InboxTable />
    </PageLayout>
  );
}
