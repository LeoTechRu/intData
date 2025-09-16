import ProfileView from '../../../components/profile/ProfileView';

interface PageParams {
  slug: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

export default async function AreaProfilePage({ params }: PageProps) {
  const resolved = await params;
  return <ProfileView entity="areas" slug={resolved.slug} backHref="/areas" backLabel="← К областям" />;
}
