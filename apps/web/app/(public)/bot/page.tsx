import type { Metadata } from 'next';

import BotLanding from '../../../components/marketing/BotLanding';

export const metadata: Metadata = {
  title: 'Telegram-бот Intelligent Data Pro — быстрый захват и автоматизация PARA',
  description:
    'Публичный лендинг @intDataBot: сценарии захвата, контроль дедлайнов, наблюдатели и интеграция с PARA. Подключите Telegram-бот к Intelligent Data Pro за несколько минут.',
};

export const dynamic = 'force-static';

export default function BotPage() {
  return <BotLanding />;
}
