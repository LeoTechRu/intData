export interface Area {
  id: number;
  name: string;
  color?: string | null;
  review_interval_days: number;
  parent_id?: number | null;
  depth: number;
  slug: string;
  mp_path: string;
}

export interface Project {
  id: number;
  name: string;
  area_id: number;
  description?: string | null;
  slug?: string | null;
}

export interface NoteAreaSummary {
  id: number;
  name: string;
  slug?: string | null;
  color?: string | null;
}

export interface NoteProjectSummary {
  id: number;
  name: string;
}

export interface Note {
  id: number;
  title?: string | null;
  content: string;
  pinned: boolean;
  archived_at?: string | null;
  order_index: number;
  area_id: number;
  project_id?: number | null;
  color: string;
  area: NoteAreaSummary;
  project?: NoteProjectSummary | null;
}

export interface Resource {
  id: number;
  title: string;
  type?: string | null;
  content?: string | null;
  updated_at?: string | null;
}

export interface ProfileSection {
  id: string;
  title?: string | null;
}

export interface Profile {
  slug: string;
  display_name: string;
  headline?: string | null;
  summary?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  profile_meta: Record<string, string | number | boolean | null>;
  tags: string[];
  sections: ProfileSection[];
  can_edit?: boolean;
  is_owner?: boolean;
}

export interface ViewerProfileSummary {
  user_id: number;
  username: string;
  role: string;
  profile_slug: string;
  display_name: string;
  avatar_url?: string | null;
  headline?: string | null;
}

export interface Task {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  due_date?: string | null;
  tracked_minutes: number;
  running_entry_id?: number | null;
  control_enabled: boolean;
  control_status?: string | null;
  control_next_at?: string | null;
  control_frequency?: number | null;
  remind_policy?: Record<string, unknown> | null;
  is_watched: boolean;
}

export type TaskStatus = 'todo' | 'doing' | 'done' | 'archived' | string;

export interface TaskStats {
  done: number;
  active: number;
  dropped: number;
}

export interface ApiListResponse<T> {
  items: T[];
}

export interface DashboardProfile {
  display_name: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  phone_href?: string | null;
  birthday?: string | null;
  language?: string | null;
  role?: string | null;
}

export interface DashboardMetric {
  id: string;
  title: string;
  value: string;
  unit?: string | null;
  delta_percent?: number | null;
}

export interface DashboardListItemMeta {
  [key: string]: string | number | boolean | null | undefined;
}

export interface DashboardListItem {
  id: string;
  title: string;
  subtitle?: string | null;
  url?: string | null;
  meta?: DashboardListItemMeta | null;
}

export interface DashboardTimelineItem {
  id: string;
  kind: string;
  title: string;
  starts_at: string;
  display_time: string;
}

export interface DashboardHabitItem {
  id: number;
  name: string;
  percent: number;
}

export interface DashboardOverview {
  profile: DashboardProfile | null;
  metrics: Record<string, DashboardMetric>;
  timeline: DashboardTimelineItem[];
  collections: Record<string, DashboardListItem[]>;
  habits: DashboardHabitItem[];
  generated_at: string;
}

export interface DashboardLayoutSettings {
  v: number;
  widgets?: string[];
  hidden?: string[];
  layouts?: Record<string, unknown>;
  columns?: number;
  gutter?: number;
}

export interface DashboardWidgetDefinition {
  key: string;
  label: string;
}

export interface FavoriteItem {
  path: string;
  label: string;
  position: number;
}

export interface FavoritesSettings {
  v: number;
  items: FavoriteItem[];
}

export interface FavoriteOption {
  path: string;
  label: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeGradient {
  from: string;
  to: string;
}

export interface ThemePreferences {
  mode?: ThemeMode;
  primary?: string | null;
  accent?: string | null;
  surface?: string | null;
  gradient?: ThemeGradient | null;
}

export interface ThemePreset extends ThemePreferences {
  id: string;
  label: string;
}

export interface AdminBrandingSettings {
  BRAND_NAME: string;
  PUBLIC_URL: string;
  BOT_LANDING_URL: string;
}

export interface AdminTelegramSettings {
  TG_LOGIN_ENABLED: boolean;
  TG_BOT_USERNAME: string | null;
  TG_BOT_TOKEN?: string | null;
}

export interface TgBotRecord {
  id: number;
  bot_username: string;
  status: string;
  token_preview?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SidebarNavStatus {
  kind: 'new' | 'wip' | 'locked' | string;
  link?: string;
}

export interface SidebarLayoutItem {
  key: string;
  position: number;
  hidden?: boolean;
}

export interface SidebarLayoutSettings {
  v: number;
  items: SidebarLayoutItem[];
  widgets?: SidebarLayoutItem[];
}

export interface SidebarNavItem {
  key: string;
  label: string;
  href?: string;
  external?: boolean;
  disabled?: boolean;
  hidden: boolean;
  position: number;
  status?: SidebarNavStatus;
}

export interface SidebarWidgetItem {
  key: string;
  label: string;
  description?: string;
  icon?: string;
  hidden: boolean;
  position: number;
}

export interface SidebarNavPayload {
  v: number;
  items: SidebarNavItem[];
  widgets: SidebarWidgetItem[];
  layout: {
    user: SidebarLayoutSettings;
    global?: SidebarLayoutSettings | null;
  };
  can_edit_global: boolean;
}

export interface TimeEntry {
  id: number;
  task_id?: number | null;
  start_time: string;
  end_time?: string | null;
  description?: string | null;
}

export interface TimeSummaryDay {
  day: string;
  total_seconds: number;
}

export interface TimeSummaryArea {
  area_id?: number | null;
  total_seconds: number;
}

export interface TimeSummaryProject {
  project_id?: number | null;
  total_seconds: number;
}

export interface AdminWebUserAccount {
  id: number;
  telegram_id: number;
  username?: string | null;
  role?: string | null;
}

export interface AdminWebUser {
  id: number;
  username: string;
  full_name?: string | null;
  email?: string | null;
  role: string;
  telegram_accounts: AdminWebUserAccount[];
}

export interface AdminTelegramUser {
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
}

export interface AdminGroupInfo {
  telegram_id: number | null;
  title: string;
  participants_count: number;
  description?: string | null;
}

export interface AdminGroupBundle {
  group: AdminGroupInfo;
  members: AdminTelegramUser[];
}

export interface AdminGroupModerationEntry {
  group_title: string;
  group_id: number | null;
  members: number;
  active: number;
  quiet: number;
  unpaid: number;
  last_activity: string | null;
}

export interface AdminOverviewPayload {
  users_web: AdminWebUser[];
  users_tg: AdminTelegramUser[];
  groups: AdminGroupBundle[];
  group_moderation: AdminGroupModerationEntry[];
  roles: string[];
}

export interface AdminSettingsPayload {
  branding: {
    BRAND_NAME: string;
    PUBLIC_URL: string;
    BOT_LANDING_URL: string;
  };
  telegram: {
    TG_LOGIN_ENABLED: boolean | string;
    TG_BOT_USERNAME: string | null;
    TG_BOT_TOKEN: boolean | string | null;
  };
}

export interface AuthConfigWarning {
  code: string;
  message: string;
}

export interface AuthOptionsPayload {
  brand_name: string;
  tagline: string;
  tg_login_enabled: boolean;
  tg_bot_username: string;
  tg_bot_login_url?: string | null;
  recaptcha_site_key?: string | null;
  magic_link_enabled: boolean;
  config_warnings: AuthConfigWarning[];
}

export interface AuthFeedbackResponse {
  ok: boolean;
  active: string;
  flash?: string | null;
  form_values: Record<string, string>;
  form_errors: Record<string, string>;
  redirect?: string | null;
  config_warnings?: AuthConfigWarning[];
}
