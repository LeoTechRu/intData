import ProfileView from '../../../components/profile/ProfileView';

interface PageParams {
  slug: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

export default async function ResourceProfilePage({ params }: PageProps) {
  const resolved = await params;
  return <ProfileView entity="resources" slug={resolved.slug} backHref="/resources" backLabel="← К ресурсам" />;
}
