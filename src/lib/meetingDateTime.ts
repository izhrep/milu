// Utilities for consistent local <-> UTC handling for timestamptz meeting_date.
// Goal: user selects local date/time, we store UTC ISO in DB, and display local in UI.

const TZ_REGEX = /(Z|[+-]\d{2}:\d{2})$/;

export const hasTimezoneDesignator = (value: string) => TZ_REGEX.test(value);

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

export function formatLocalTimeInputValue(date: Date): string {
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `${hours}:${minutes}`;
}

/**
 * Parse a string like "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss" as LOCAL time.
 * Returns null if cannot parse.
 */
export function parseLocalDateTimeString(value: string): Date | null {
  // Accept: YYYY-MM-DDTHH:mm[:ss]
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] ? Number(m[6]) : 0;
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

/**
 * Parse meeting_date that may be:
 * - timestamptz string with timezone (from DB)
 * - local naive string (from date/time inputs)
 */
export function parseMeetingDateTime(value: string): Date | null {
  if (!value) return null;

  if (hasTimezoneDesignator(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const local = parseLocalDateTimeString(value);
  if (local) return local;

  // Fallback: try native parsing as last resort
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildLocalDateTimeString(dateStr: string, timeStr: string): string {
  const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return `${dateStr}T${time}`;
}

/** Convert meeting_date string to UTC ISO string suitable for timestamptz storage. */
export function normalizeMeetingDateToUtcIso(value: string): string {
  const d = parseMeetingDateTime(value);
  if (!d) return value;
  return d.toISOString();
}
