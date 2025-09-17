import Link from 'next/link';
import PageLayout from '../../components/PageLayout';

const MODULE_TITLE = 'Тарифы Intelligent Data Pro';
const MODULE_DESCRIPTION =
  'Расширьте доступ к модулям, чтобы открыть привычки, автоматизации и другие продвинутые возможности для команды.';

const INCLUDED_FEATURES = [
  'Полный доступ к модулю «Привычки» с экономикой XP/Gold/HP и игровыми сценариями.',
  'Командные роли и продвинутые права доступа к Areas и Projects.',
  'Автоматизации, дополнительные интеграции и поддержку командных рабочих пространств.',
];

export default function PricingPage() {
  return (
    <PageLayout
      title={MODULE_TITLE}
      description={MODULE_DESCRIPTION}
      headingLevel={1}
      contentClassName="flex flex-col gap-6 p-6 md:p-10"
    >
      <section className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface-soft p-6 shadow-soft">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Что входит в расширенные тарифы</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--text-primary)]">
          {INCLUDED_FEATURES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Индивидуальные условия доступны для команд любого размера. Поддерживаем оплату в рублях и международных валютах.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/products"
            prefetch={false}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 text-sm font-medium text-[var(--accent-on-primary)] shadow-soft transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
          >
            Смотреть тарифы и продукты
          </Link>
          <a
            href="mailto:hello@intdata.pro?subject=Тарифы%20Intelligent%20Data%20Pro"
            className="text-sm font-medium text-[var(--accent-primary)] underline decoration-dotted decoration-[color-mix(in srgb, var(--accent-primary) 60%, transparent)]"
          >
            Написать менеджеру
          </a>
        </div>
      </section>
      <section className="grid gap-4 rounded-2xl border border-dashed border-subtle p-6 text-sm text-muted">
        <div>
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent-primary)]">
            Как получить доступ
          </span>
        </div>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Выберите подходящий тариф на странице продуктов и оформите подписку.</li>
          <li>После оплаты напишите в поддержку или администратору рабочей области.</li>
          <li>Мы активируем модуль «Привычки» и другие доступы в течение одного рабочего дня.</li>
        </ol>
        <p>
          Уже приобретали подписку? Убедитесь, что ваш администратор назначил расширенную роль или обратитесь в поддержку — мы проверим статус доступа.
        </p>
      </section>
    </PageLayout>
  );
}
