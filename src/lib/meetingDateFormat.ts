/**
 * Timezone-aware formatting for meeting dates in UI.
 * Uses the user's stored timezone (from users.timezone in DB).
 * Fallback: browser timezone (never hardcoded Moscow).
 */

import { getBrowserTimezone } from '@/lib/meetingDateTime';

function safeTimezone(tz?: string): string {
  if (!tz) return getBrowserTimezone();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return getBrowserTimezone();
  }
}

/**
 * Format a meeting date string (UTC ISO from DB) for display in UI,
 * using the user's stored timezone.
 *
 * Example: "15 апреля 2026, 14:30"
 */
export function formatMeetingDateFull(dateStr: string, timezone?: string): string {
  const tz = safeTimezone(timezone);
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a meeting date string for short display.
 * Example: "15 апр, 14:30"
 */
export function formatMeetingDateShort(dateStr: string, timezone?: string): string {
  const tz = safeTimezone(timezone);
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a meeting date for date-only display.
 * Example: "15 апр"
 */
export function formatMeetingDateOnly(dateStr: string, timezone?: string): string {
  const tz = safeTimezone(timezone);
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      timeZone: tz,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a meeting date with day, month and time in the given timezone.
 * Example: "15 апр, 14:30"
 */
export function formatMeetingDateTimeShort(dateStr: string, timezone?: string): string {
  const tz = safeTimezone(timezone);
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Get a Date object representing the meeting time in the user's timezone,
 * for comparison purposes (e.g. "is meeting in the past?").
 * Note: The returned Date is still a UTC-based JS Date; we just need
 * the UTC timestamp for comparisons since both sides use UTC internally.
 */
export function getMeetingTimestamp(dateStr: string): number {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}
