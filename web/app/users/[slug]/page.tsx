import ProfileView from '../../../components/profile/ProfileView';

interface PageProps {
  params: { slug: string };
}

export default function UserProfilePage({ params }: PageProps) {
  return <ProfileView entity="users" slug={params.slug} backHref="/users" backLabel="← К каталогу" />;
}
