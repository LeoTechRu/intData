import ProfileView from '../../../components/profile/ProfileView';

interface PageProps {
  params: { slug: string };
}

export default function ResourceProfilePage({ params }: PageProps) {
  return <ProfileView entity="resources" slug={params.slug} backHref="/resources" backLabel="← К ресурсам" />;
}
