/**
 * Timezone test scenarios for meeting notifications.
 * These document expected behavior and can be run manually or automated.
 *
 * Run with: deno test --allow-net --allow-env supabase/functions/tests/timezone_test.ts
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// ─── Helper: simulate formatMeetingDateRu ───
function formatMeetingDateRu(dateStr: string, timezone = "Europe/Moscow"): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    });
  } catch {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("ru-RU", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Moscow",
      });
    } catch {
      return dateStr;
    }
  }
}

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function resolveTimezone(tz: string | null | undefined): string {
  if (tz && isValidTimezone(tz)) return tz;
  return "Europe/Moscow";
}

// ─── Test: UTC+3 vs UTC+7 same meeting ───
Deno.test("UTC+3 user sees Moscow time", () => {
  // Meeting at 2026-03-30 18:05 UTC (21:05 MSK)
  const meetingUtc = "2026-03-30T18:05:00Z";
  const result = formatMeetingDateRu(meetingUtc, "Europe/Moscow");
  // Should show 30 марта 21:05
  assertEquals(result.includes("30"), true, `Expected '30' in '${result}'`);
  assertEquals(result.includes("21:05"), true, `Expected '21:05' in '${result}'`);
});

Deno.test("UTC+7 user sees Krasnoyarsk time (midnight crossing)", () => {
  // Same meeting: 2026-03-30 18:05 UTC = 2026-03-31 01:05 in Asia/Krasnoyarsk (UTC+7)
  const meetingUtc = "2026-03-30T18:05:00Z";
  const result = formatMeetingDateRu(meetingUtc, "Asia/Krasnoyarsk");
  // Should show 31 марта 01:05
  assertEquals(result.includes("31"), true, `Expected '31' in '${result}'`);
  assertEquals(result.includes("01:05"), true, `Expected '01:05' in '${result}'`);
});

// ─── Test: Missing timezone → fallback ───
Deno.test("null timezone resolves to Europe/Moscow", () => {
  assertEquals(resolveTimezone(null), "Europe/Moscow");
});

Deno.test("undefined timezone resolves to Europe/Moscow", () => {
  assertEquals(resolveTimezone(undefined), "Europe/Moscow");
});

Deno.test("empty string timezone resolves to Europe/Moscow", () => {
  assertEquals(resolveTimezone(""), "Europe/Moscow");
});

// ─── Test: Invalid timezone → fallback ───
Deno.test("invalid timezone resolves to Europe/Moscow", () => {
  assertEquals(resolveTimezone("Invalid/Zone"), "Europe/Moscow");
});

Deno.test("formatMeetingDateRu with invalid timezone falls back to Moscow", () => {
  const meetingUtc = "2026-03-30T18:05:00Z";
  const result = formatMeetingDateRu(meetingUtc, "Invalid/Zone_Name");
  // Should still produce a valid date string (Moscow fallback)
  assertEquals(result.includes("30"), true, `Expected '30' in '${result}'`);
});

// ─── Test: Valid IANA timezones ───
Deno.test("isValidTimezone returns true for valid zones", () => {
  assertEquals(isValidTimezone("Europe/Moscow"), true);
  assertEquals(isValidTimezone("Asia/Krasnoyarsk"), true);
  assertEquals(isValidTimezone("Asia/Vladivostok"), true);
  assertEquals(isValidTimezone("America/New_York"), true);
});

Deno.test("isValidTimezone returns false for invalid zones", () => {
  assertEquals(isValidTimezone("Invalid/Zone"), false);
  assertEquals(isValidTimezone(""), false);
  assertEquals(isValidTimezone("UTC+3"), false);
});

// ─── Test: Midnight boundary — same UTC, different dates ───
Deno.test("midnight boundary: UTC+3 sees March 30, UTC+12 sees March 31", () => {
  // 2026-03-30 20:30 UTC = 23:30 MSK (still March 30) = 08:30 next day in UTC+12
  const meetingUtc = "2026-03-30T20:30:00Z";
  const msk = formatMeetingDateRu(meetingUtc, "Europe/Moscow");
  const kamchatka = formatMeetingDateRu(meetingUtc, "Asia/Kamchatka");

  assertEquals(msk.includes("30"), true, `MSK should show 30, got '${msk}'`);
  assertEquals(kamchatka.includes("31"), true, `Kamchatka should show 31, got '${kamchatka}'`);
});

// ─── Test: Reminder 1h before in recipient timezone ───
Deno.test("1-hour reminder shows correct local time for UTC+7", () => {
  // Meeting at 2026-03-30 18:05 UTC
  // Reminder at 2026-03-30 17:05 UTC
  // For UTC+7 user: reminder = 2026-03-31 00:05
  const reminderUtc = "2026-03-30T17:05:00Z";
  const result = formatMeetingDateRu(reminderUtc, "Asia/Krasnoyarsk");
  assertEquals(result.includes("31"), true, `Expected '31' in '${result}'`);
  assertEquals(result.includes("00:05"), true, `Expected '00:05' in '${result}'`);
});
