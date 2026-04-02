/**
 * Shared timezone utilities for edge functions.
 * Centralizes IANA validation, date formatting, and fallback logic.
 */

const FALLBACK_TIMEZONE = "Europe/Moscow";

/**
 * Validate an IANA timezone string by attempting to use it with Intl.
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
 * Resolve a timezone value: validate it, fallback to Europe/Moscow if invalid/missing.
 * Logs a warning when fallback is used.
 */
export function resolveTimezone(tz: string | null | undefined, userId?: string): string {
  if (tz && isValidTimezone(tz)) {
    return tz;
  }
  const context = userId ? ` for user ${userId}` : "";
  console.warn(`[timezone] Fallback to ${FALLBACK_TIMEZONE}${context}: received "${tz}"`);
  return FALLBACK_TIMEZONE;
}

/**
 * Format a date string in Russian locale with the given timezone.
 * Used for all meeting notification texts.
 *
 * Example output: "31 марта в 01:05"
 */
export function formatMeetingDateRu(dateStr: string, timezone?: string): string {
  const tz = resolveTimezone(timezone);
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    });
  } catch {
    // Double fallback — should never happen since we validated tz above
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("ru-RU", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: FALLBACK_TIMEZONE,
      });
    } catch {
      return dateStr;
    }
  }
}

export { FALLBACK_TIMEZONE };
