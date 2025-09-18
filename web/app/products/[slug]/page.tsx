import ProfileView from '../../../components/profile/ProfileView';

interface PageParams {
  slug: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

export default async function ProductProfilePage({ params }: PageProps) {
  const resolved = await params;
  return <ProfileView entity="products" slug={resolved.slug} backHref="/products" backLabel="← К каталогу продуктов" />;
}
