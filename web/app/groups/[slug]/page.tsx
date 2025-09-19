import ProfileView from '../../../components/profile/ProfileView';

interface PageParams {
  slug: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

export default async function GroupProfilePage({ params }: PageProps) {
  const resolved = await params;
  return <ProfileView entity="groups" slug={resolved.slug} backHref="/groups" backLabel="← К списку групп" />;
}
