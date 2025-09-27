import PageLayout from '../../components/PageLayout';
import InboxModule from '../../components/inbox/InboxModule';

const MODULE_TITLE = 'Входящие';
const MODULE_DESCRIPTION =
  'Все неразобранные заметки, задачи, события, проекты и ресурсы до назначения в PARA. Разберите их, чтобы они не превратились в потеряшки.';

export default function InboxPage() {
  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION}>
      <InboxModule />
    </PageLayout>
  );
}
