/**
 * Unified timezone utilities for the entire meeting module.
 *
 * Contract:
 * - effectiveTimezone = users.timezone from profile if valid, else browser TZ
 * - All local→UTC conversions use date-fns-tz (DST-safe)
 * - All UTC→display conversions use Intl.DateTimeFormat({ timeZone })
 * - Server fallback remains Europe/Moscow (agreed product decision)
 */

import { fromZonedTime } from 'date-fns-tz';

// ─── Timezone resolution ───

/**
 * Validate an IANA timezone string.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the browser/OS IANA timezone.
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Resolve the effective timezone for the current user.
 * Source of truth: users.timezone from profile.
 * Fallback: browser/OS timezone.
 * Never uses Europe/Moscow as hidden default on the client.
 */
export function getEffectiveTimezone(profileTimezone?: string | null): string {
  if (profileTimezone && isValidTimezone(profileTimezone)) {
    return profileTimezone;
  }
  return getBrowserTimezone();
}

// ─── Local ↔ UTC conversion ───

const TZ_REGEX = /(Z|[+-]\d{2}:\d{2})$/;
export const hasTimezoneDesignator = (value: string) => TZ_REGEX.test(value);
export const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Convert user-entered date + time in their effective timezone to a UTC ISO string.
 * Uses date-fns-tz for DST-safe conversion.
 *
 * @param dateStr - "YYYY-MM-DD"
 * @param timeStr - "HH:MM" or "HH:MM:SS"
 * @param timezone - IANA timezone (from getEffectiveTimezone)
 */
export function localDateTimeToUtcIso(dateStr: string, timeStr: string, timezone: string): string {
  const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const naive = `${dateStr}T${time}`;
  // fromZonedTime interprets the naive datetime as being in `timezone` and returns UTC Date
  const utcDate = fromZonedTime(naive, timezone);
  if (isNaN(utcDate.getTime())) return naive;
  return utcDate.toISOString();
}

/**
 * Build a naive local datetime string (for intermediate form state).
 */
export function buildLocalDateTimeString(dateStr: string, timeStr: string): string {
  const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return `${dateStr}T${time}`;
}

// ─── Display helpers (UTC Date → user's timezone) ───

/**
 * Format a UTC Date for the date input value (YYYY-MM-DD) in the user's timezone.
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = parts.find(p => p.type === 'year')?.value || '';
    const m = parts.find(p => p.type === 'month')?.value || '';
    const d = parts.find(p => p.type === 'day')?.value || '';
    return `${y}-${m}-${d}`;
  } catch {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }
}

/**
 * Format a UTC Date for the time input value (HH:MM) in the user's timezone.
 */
export function formatTimeInTimezone(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const h = parts.find(p => p.type === 'hour')?.value || '00';
    const min = parts.find(p => p.type === 'minute')?.value || '00';
    return `${h}:${min}`;
  } catch {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
}

/**
 * Get a short human-readable timezone offset label like "UTC+7" or "UTC−3:30".
 */
export function getTimezoneOffsetLabel(timezone: string): string {
  try {
    // Use Intl to get the GMT offset string
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).format(new Date());
    // Extracts "GMT+7", "GMT-3:30", "GMT" etc.
    const match = formatted.match(/GMT([+-]\d{1,2}(?::\d{2})?)?/);
    if (!match) return timezone;
    const offset = match[1];
    if (!offset) return 'UTC';
    return `UTC${offset}`;
  } catch {
    return timezone;
  }
}

// ─── Current time in timezone ───

/**
 * Get the current time parts (HH:MM and YYYY-MM-DD) in a given IANA timezone.
 */
export function getNowInTimezone(timezone: string): { date: string; time: string } {
  try {
    const now = new Date();
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const timeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const y = dateParts.find(p => p.type === 'year')?.value || '';
    const mo = dateParts.find(p => p.type === 'month')?.value || '';
    const d = dateParts.find(p => p.type === 'day')?.value || '';
    const h = timeParts.find(p => p.type === 'hour')?.value || '00';
    const min = timeParts.find(p => p.type === 'minute')?.value || '00';

    return { date: `${y}-${mo}-${d}`, time: `${h}:${min}` };
  } catch {
    return { date: '', time: '' };
  }
}

/**
 * For a given date string (YYYY-MM-DD) and timezone, return the minimum allowed
 * time (HH:MM) if the date is "today" in that timezone, or null otherwise.
 */
export function getMinTimeForDate(dateStr: string, timezone: string): string | null {
  if (!dateStr) return null;
  const now = getNowInTimezone(timezone);
  if (dateStr !== now.date) return null;
  return now.time;
}

// ─── Parsing ───

/**
 * Parse a string like "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss" as LOCAL time.
 */
export function parseLocalDateTimeString(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), m[6] ? Number(m[6]) : 0, 0);
}

/**
 * Parse meeting_date that may be:
 * - timestamptz string with timezone (from DB) → UTC Date
 * - local naive string (from form state) → browser-local Date
 */
export function parseMeetingDateTime(value: string): Date | null {
  if (!value) return null;
  if (hasTimezoneDesignator(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const local = parseLocalDateTimeString(value);
  if (local) return local;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Convert meeting_date string to UTC ISO string (legacy, browser-local). */
export function normalizeMeetingDateToUtcIso(value: string): string {
  const d = parseMeetingDateTime(value);
  if (!d) return value;
  return d.toISOString();
}

// Legacy re-exports for backward compat
export function formatLocalDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatLocalTimeInputValue(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
