import ProfileView from '../../../components/profile/ProfileView';

interface PageProps {
  params: { slug: string };
}

export default function ProjectProfilePage({ params }: PageProps) {
  return <ProfileView entity="projects" slug={params.slug} backHref="/projects" backLabel="← К проектам" />;
}
