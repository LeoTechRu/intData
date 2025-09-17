import ProfileView from '../../../components/profile/ProfileView';

interface PageParams {
  slug: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

export default async function ProjectProfilePage({ params }: PageProps) {
  const resolved = await params;
  return <ProfileView entity="projects" slug={resolved.slug} backHref="/projects" backLabel="← К проектам" />;
}
