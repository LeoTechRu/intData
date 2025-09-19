import type { Metadata } from 'next';

import AuthLanding from '../../../components/auth/AuthLanding';

export const metadata: Metadata = {
  title: 'Intelligent Data Pro — вход и регистрация',
  description:
    'Зарегистрируйтесь в Intelligent Data Pro и получите доступ к PARA, календарю, привычкам и дашборду «Сегодня» бесплатно. Современный лендинг с ценностью продукта до авторизации.',
};

export const dynamic = 'force-static';

export default function AuthPage() {
  return <AuthLanding />;
}
