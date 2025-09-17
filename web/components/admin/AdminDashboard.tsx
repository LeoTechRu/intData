'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import type { ChangeEvent, ComponentProps, FormEvent } from 'react';

import { apiFetch, ApiError } from '../../lib/api';
import type {
  AdminOverviewPayload,
  AdminSettingsPayload,
  AdminTelegramUser,
  AdminWebUser,
} from '../../lib/types';
import { Badge, Button, Card, Input } from '../ui';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const overviewQuery = useQuery<AdminOverviewPayload>({
    queryKey: ['admin', 'overview'],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: () => apiFetch<AdminOverviewPayload>('/api/v1/admin/overview'),
  });

  const settingsQuery = useQuery<AdminSettingsPayload>({
    queryKey: ['admin', 'settings'],
    queryFn: () => apiFetch<AdminSettingsPayload>('/api/v1/admin/settings'),
    staleTime: 120_000,
    gcTime: 300_000,
  });

  const overview = overviewQuery.data;
  const roles = overview?.roles ?? [];

  return (
    <div className="flex flex-col gap-6 pb-16">
      <header className="rounded-2xl border border-subtle bg-[var(--surface-0)] px-6 py-5 shadow-soft">
        <div className="space-y-2 text-sm text-muted">
          <p>
            Управляйте пользователями, Telegram-группами и настройками рабочей области из единого центра. Все действия
            требуют роли <strong>admin</strong> и логируются для аудита.
          </p>
          {overviewQuery.isLoading ? <p className="text-xs text-muted">Загружаем данные…</p> : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <SectionHeader title="Web-пользователи" description="Управляйте ролями и связками с Telegram-аккаунтами." />
          <WebUsersTable data={overview?.users_web ?? []} roles={roles} tgUsers={overview?.users_tg ?? []} />
        </Card>
        <Card className="overflow-hidden">
          <SectionHeader title="Telegram-пользователи" description="Изменяйте роли и отслеживайте первичные контакты." />
          <TelegramUsersTable data={overview?.users_tg ?? []} roles={roles} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Telegram-группы" description="Список подключённых групп и участников." />
          <GroupsList data={overview?.groups ?? []} />
        </Card>
        <Card>
          <SectionHeader
            title="Модерация групп"
            description="Ключевые показатели активности, оплаты и тихих участников."
          />
          <GroupModerationTable data={overview?.group_moderation ?? []} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <BrandingForm settings={settingsQuery.data} isLoading={settingsQuery.isLoading} />
        <TelegramSettingsForm settings={settingsQuery.data} isLoading={settingsQuery.isLoading} />
      </div>

      <RestartControls />
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-4 flex flex-col gap-1">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      {description ? <p className="text-xs text-muted">{description}</p> : null}
    </header>
  );
}

function WebUsersTable({ data, roles, tgUsers }: { data: AdminWebUser[]; roles: string[]; tgUsers: AdminTelegramUser[] }) {
  const queryClient = useQueryClient();
  const linkMutation = useMutation({
    mutationFn: async ({ webUserId, tgUserId }: { webUserId: number; tgUserId: number }) => {
      await apiFetch(`/api/v1/admin/web/link?web_user_id=${webUserId}&tg_user_id=${tgUserId}`, { method: 'POST' });
    },
    onError: handleApiError,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
  });
  const unlinkMutation = useMutation({
    mutationFn: async ({ webUserId, tgUserId }: { webUserId: number; tgUserId: number }) => {
      await apiFetch(`/api/v1/admin/web/unlink?web_user_id=${webUserId}&tg_user_id=${tgUserId}`, { method: 'POST' });
    },
    onError: handleApiError,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
  });
  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      await apiFetch(`/api/v1/admin/web/role/${userId}?role=${encodeURIComponent(role)}`, { method: 'POST' });
    },
    onError: handleApiError,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
  });

  const [pendingLink, setPendingLink] = useState<Record<number, string>>({});

  const loading = linkMutation.isPending || unlinkMutation.isPending || roleMutation.isPending;

  if (!data.length) {
    return <TableEmptyState message="Пока нет web-пользователей." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] table-fixed border-separate border-spacing-y-2 text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Логин</th>
            <th className="px-3 py-2 text-left">Email</th>
            <th className="px-3 py-2 text-left">Telegram</th>
            <th className="px-3 py-2 text-left">Роль</th>
          </tr>
        </thead>
        <tbody>
          {data.map((user) => (
            <tr key={user.id} className="rounded-xl bg-surface-soft text-[var(--text-primary)]">
              <td className="rounded-l-xl px-3 py-3 align-top font-medium">{user.id}</td>
              <td className="px-3 py-3 align-top">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{user.username}</span>
                  {user.full_name ? <span className="text-xs text-muted">{user.full_name}</span> : null}
                </div>
              </td>
              <td className="px-3 py-3 align-top text-xs text-muted">{user.email || '—'}</td>
              <td className="px-3 py-3 align-top">
                <div className="flex flex-col gap-2">
                  {user.telegram_accounts.length ? (
                    user.telegram_accounts.map((account) => (
                      <div key={account.id} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-0)] px-2 py-1 text-xs">
                        <span>@{account.username || account.telegram_id}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[0.7rem]"
                          disabled={loading}
                          onClick={() => unlinkMutation.mutate({ webUserId: user.id, tgUserId: account.id })}
                        >
                          Отвязать
                        </Button>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-muted">Связанных аккаунтов нет</span>
                  )}
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 flex-1 rounded-lg border border-subtle bg-[var(--surface-0)] px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                      value={pendingLink[user.id] ?? ''}
                      onChange={(event) => setPendingLink((prev) => ({ ...prev, [user.id]: event.target.value }))}
                    >
                      <option value="">Выберите TG пользователя</option>
                      {tgUsers.map((tg) => (
                        <option key={tg.telegram_id} value={tg.telegram_id}>
                          @{tg.username || tg.telegram_id}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 px-3 text-xs"
                      disabled={!pendingLink[user.id] || loading}
                      onClick={() => {
                        const selected = pendingLink[user.id];
                        if (!selected) return;
                        linkMutation.mutate({ webUserId: user.id, tgUserId: Number(selected) });
                      }}
                    >
                      Связать
                    </Button>
                  </div>
                </div>
              </td>
              <td className="rounded-r-xl px-3 py-3 align-top">
                <select
                  className="h-9 w-full rounded-lg border border-subtle bg-[var(--surface-0)] px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                  value={user.role}
                  onChange={(event) => roleMutation.mutate({ userId: user.id, role: event.target.value })}
                  disabled={loading}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TelegramUsersTable({ data, roles }: { data: AdminTelegramUser[]; roles: string[] }) {
  const queryClient = useQueryClient();
  const roleMutation = useMutation({
    mutationFn: async ({ telegramId, role }: { telegramId: number; role: string }) => {
      await apiFetch(`/api/v1/admin/role/${telegramId}?role=${encodeURIComponent(role)}`, { method: 'POST' });
    },
    onError: handleApiError,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
  });

  if (!data.length) {
    return <TableEmptyState message="Telegram-пользователей пока нет." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-y-2 text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Пользователь</th>
            <th className="px-3 py-2 text-left">Роль</th>
          </tr>
        </thead>
        <tbody>
          {data.map((user) => (
            <tr key={user.telegram_id} className="rounded-xl bg-surface-soft">
              <td className="rounded-l-xl px-3 py-3 font-medium">{user.telegram_id}</td>
              <td className="px-3 py-3">
                <div className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-sm text-[var(--text-primary)]">@{user.username || user.telegram_id}</span>
                  <span className="text-muted">{formatName(user)}</span>
                </div>
              </td>
              <td className="rounded-r-xl px-3 py-3">
                <select
                  className="h-9 w-full rounded-lg border border-subtle bg-[var(--surface-0)] px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                  value={user.role || ''}
                  onChange={(event) => roleMutation.mutate({ telegramId: user.telegram_id, role: event.target.value })}
                  disabled={roleMutation.isPending}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupsList({ data }: { data: AdminOverviewPayload['groups'] }) {
  if (!data.length) {
    return <TableEmptyState message="Нет подключённых Telegram-групп." />;
  }
  return (
    <div className="flex flex-col gap-3 text-sm">
      {data.map((bundle) => (
        <div key={bundle.group.telegram_id ?? bundle.group.title} className="rounded-xl border border-subtle bg-surface-soft p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-[var(--text-primary)]">{bundle.group.title}</p>
              <p className="text-xs text-muted">{bundle.group.participants_count} участников</p>
            </div>
            <Badge tone="accent" size="sm">
              TG-ID: {bundle.group.telegram_id ?? '—'}
            </Badge>
          </div>
          {bundle.members.length ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
              {bundle.members.slice(0, 6).map((member) => (
                <span key={member.telegram_id} className="rounded-lg bg-[var(--surface-0)] px-2 py-1">
                  @{member.username || member.telegram_id}
                </span>
              ))}
              {bundle.members.length > 6 ? <span>ещё {bundle.members.length - 6}</span> : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function GroupModerationTable({ data }: { data: AdminOverviewPayload['group_moderation'] }) {
  if (!data.length) {
    return <TableEmptyState message="Статистика появится после подключения групп." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] table-fixed border-separate border-spacing-y-2 text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 text-left">Группа</th>
            <th className="px-3 py-2 text-left">Активны</th>
            <th className="px-3 py-2 text-left">Тихие</th>
            <th className="px-3 py-2 text-left">Без оплаты</th>
            <th className="px-3 py-2 text-left">Последняя активность</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={`${item.group_id ?? item.group_title}`} className="rounded-xl bg-surface-soft">
              <td className="rounded-l-xl px-3 py-3 font-medium text-[var(--text-primary)]">{item.group_title}</td>
              <td className="px-3 py-3">{item.active}/{item.members}</td>
              <td className="px-3 py-3">{item.quiet}</td>
              <td className="px-3 py-3">{item.unpaid}</td>
              <td className="rounded-r-xl px-3 py-3 text-xs text-muted">{formatDate(item.last_activity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BrandingForm({ settings, isLoading }: { settings: AdminSettingsPayload | undefined; isLoading: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => ({
    BRAND_NAME: settings?.branding.BRAND_NAME ?? '',
    PUBLIC_URL: settings?.branding.PUBLIC_URL ?? '',
    BOT_LANDING_URL: settings?.branding.BOT_LANDING_URL ?? '',
  }));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (settings) {
      setForm({
        BRAND_NAME: settings.branding.BRAND_NAME,
        PUBLIC_URL: settings.branding.PUBLIC_URL,
        BOT_LANDING_URL: settings.branding.BOT_LANDING_URL,
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async () => {
      await apiFetch('/api/v1/admin/settings/branding', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
    },
    onError: handleApiError,
    onSuccess: async () => {
      setStatus('saved');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      setTimeout(() => setStatus('idle'), 2000);
    },
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('saving');
    await mutation.mutateAsync();
  };

  return (
    <Card>
      <SectionHeader title="Брендинг" description="Обновите публичные ссылки и отображаемое имя продукта." />
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <LabelledInput
          label="Имя бренда"
          name="BRAND_NAME"
          value={form.BRAND_NAME}
          onChange={handleChange}
          disabled={isLoading}
          required
        />
        <LabelledInput
          label="Публичный URL"
          name="PUBLIC_URL"
          value={form.PUBLIC_URL}
          onChange={handleChange}
          disabled={isLoading}
          required
        />
        <LabelledInput
          label="URL лендинга бота"
          name="BOT_LANDING_URL"
          value={form.BOT_LANDING_URL}
          onChange={handleChange}
          disabled={isLoading}
          required
        />
        <div className="flex items-center justify-between gap-3">
          <Button type="submit" size="sm" disabled={mutation.isPending}>
            Сохранить
          </Button>
          <FormStatus status={status} />
        </div>
      </form>
    </Card>
  );
}

function TelegramSettingsForm({ settings, isLoading }: { settings: AdminSettingsPayload | undefined; isLoading: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => ({
    TG_LOGIN_ENABLED: Boolean(settings?.telegram.TG_LOGIN_ENABLED) ?? false,
    TG_BOT_USERNAME: settings?.telegram.TG_BOT_USERNAME ?? '',
    TG_BOT_TOKEN: '',
  }));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (settings) {
      setForm({
        TG_LOGIN_ENABLED: settings.telegram.TG_LOGIN_ENABLED === true || settings.telegram.TG_LOGIN_ENABLED === '1',
        TG_BOT_USERNAME: settings.telegram.TG_BOT_USERNAME ?? '',
        TG_BOT_TOKEN: '',
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async () => {
      await apiFetch('/api/v1/admin/settings/telegram', {
        method: 'PATCH',
        body: JSON.stringify({
          TG_LOGIN_ENABLED: form.TG_LOGIN_ENABLED,
          TG_BOT_USERNAME: form.TG_BOT_USERNAME,
          TG_BOT_TOKEN: form.TG_BOT_TOKEN || null,
        }),
      });
    },
    onError: handleApiError,
    onSuccess: async () => {
      setStatus('saved');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      setTimeout(() => setStatus('idle'), 2000);
    },
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('saving');
    await mutation.mutateAsync();
  };

  return (
    <Card>
      <SectionHeader title="Telegram" description="Управляйте авторизацией и токеном бота." />
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
          <input
            type="checkbox"
            name="TG_LOGIN_ENABLED"
            checked={form.TG_LOGIN_ENABLED}
            onChange={handleChange}
            disabled={isLoading}
            className="h-4 w-4 rounded border border-subtle"
          />
          Включить Telegram Login
        </label>
        <LabelledInput
          label="Имя бота"
          name="TG_BOT_USERNAME"
          value={form.TG_BOT_USERNAME}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="username без @"
        />
        <LabelledInput
          label="Новый токен"
          name="TG_BOT_TOKEN"
          type="password"
          value={form.TG_BOT_TOKEN}
          onChange={handleChange}
          disabled={isLoading}
          placeholder="Оставьте пустым, если без изменений"
        />
        <div className="flex items-center justify-between gap-3">
          <Button type="submit" size="sm" disabled={mutation.isPending}>
            Сохранить
          </Button>
          <FormStatus status={status} />
        </div>
      </form>
    </Card>
  );
}

function RestartControls() {
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async (target: 'web' | 'bot') => {
      const response = await apiFetch<{ ok: boolean; stderr?: string; error?: string }>(
        `/api/v1/admin/restart?target=${target}`,
        { method: 'POST' },
      );
      if (!response.ok) {
        throw new Error(response.error || response.stderr || 'Не удалось перезапустить');
      }
      return target;
    },
    onSuccess: (target) => {
      setMessage(`Сервис ${target} перезапущен`);
      setTimeout(() => setMessage(null), 2500);
    },
    onError: (error: unknown) => {
      setMessage(`Ошибка: ${(error as Error).message}`);
      setTimeout(() => setMessage(null), 3500);
    },
  });

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Перезапуск сервисов</h2>
        <p className="text-xs text-muted">Доступно только при корректной настройке sudoers на хосте.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate('web')}>
          Рестарт web
        </Button>
        <Button variant="secondary" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate('bot')}>
          Рестарт bot
        </Button>
      </div>
      {message ? <p className="w-full text-xs text-muted">{message}</p> : null}
    </Card>
  );
}

function LabelledInput({ label, className, ...props }: { label: string } & ComponentProps<typeof Input>) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-primary)]">
      {label}
      <Input {...props} className={clsx('mt-1 text-sm', className)} />
    </label>
  );
}

function FormStatus({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'saving') {
    return <span className="text-xs text-muted">Сохраняем…</span>;
  }
  if (status === 'saved') {
    return <span className="text-xs text-emerald-600">Изменения сохранены</span>;
  }
  if (status === 'error') {
    return <span className="text-xs text-red-500">Ошибка сохранения</span>;
  }
  return null;
}

function TableEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-subtle bg-surface-soft px-4 py-8 text-center text-sm text-muted">
      {message}
    </div>
  );
}

function formatName(user: AdminTelegramUser): string {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return value;
  }
}

function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    console.error('Админское действие завершилось ошибкой', error.status, error.info);
    return;
  }
  console.error('Админское действие завершилось ошибкой', error);
}
