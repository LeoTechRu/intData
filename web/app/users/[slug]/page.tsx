import ProfileView from '../../../components/profile/ProfileView';

interface PageParams {
  slug: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

export default async function UserProfilePage({ params }: PageProps) {
  const resolved = await params;
  return <ProfileView entity="users" slug={resolved.slug} backHref="/users" backLabel="← К каталогу" />;
}
