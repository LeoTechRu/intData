import ProfileView from '../../../components/profile/ProfileView';

interface PageProps {
  params: { slug: string };
}

export default function AreaProfilePage({ params }: PageProps) {
  return <ProfileView entity="areas" slug={params.slug} backHref="/areas" backLabel="← К областям" />;
}
