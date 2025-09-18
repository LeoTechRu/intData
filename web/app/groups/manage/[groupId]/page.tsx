import { GroupDetailModule } from '../../../../components/groups';

interface PageParams {
  groupId: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

export default async function GroupManagePage({ params }: PageProps) {
  const resolved = await params;
  const groupId = Number(resolved.groupId);
  if (!Number.isFinite(groupId) || groupId <= 0) {
    return <div className="p-6 text-sm text-red-600">Некорректный идентификатор группы.</div>;
  }
  return <GroupDetailModule groupId={groupId} />;
}
