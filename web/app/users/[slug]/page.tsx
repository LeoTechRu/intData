import UsersRouteView from '../../../components/users/UsersRouteView';

export const dynamic = 'force-static';
export const dynamicParams = true;

export default function UserProfilePage() {
  return <UsersRouteView />;
}
