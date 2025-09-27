export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0) {
    return `${hours} ч ${rest} мин`;
  }
  return `${rest} мин`;
}

const ISO_TZ_PATTERN = /([+-]\d{2}:\d{2}|Z)$/;
const ISO_NO_TZ_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

export function parseDateToUtc(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  if (ISO_TZ_PATTERN.test(value)) {
    return new Date(value);
  }
  if (ISO_NO_TZ_PATTERN.test(value)) {
    const normalized = value.replace(' ', 'T');
    return new Date(`${normalized}Z`);
  }
  return new Date(value);
}

export function formatDateTime(value?: string | null, timeZone?: string): string {
  if (!value) {
    return '—';
  }
  const date = parseDateToUtc(value);
  if (!date || Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timeZone || undefined,
  });
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${rest.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

export function normalizeTimerDescription(description?: string | null): string | null {
  if (!description) {
    return null;
  }
  const trimmed = description.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.toLowerCase() === 'быстрый таймер') {
    return null;
  }
  return trimmed;
}
