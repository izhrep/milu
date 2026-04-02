import { describe, it, expect } from 'vitest';
import {
  localDateTimeToUtcIso,
  getEffectiveTimezone,
  formatDateInTimezone,
  formatTimeInTimezone,
  getTimezoneOffsetLabel,
  parseMeetingDateTime,
} from './meetingDateTime';

describe('localDateTimeToUtcIso', () => {
  it('converts UTC+7 (Krasnoyarsk) 15:00 → 08:00 UTC', () => {
    const result = localDateTimeToUtcIso('2026-04-03', '15:00', 'Asia/Krasnoyarsk');
    expect(result).toBe('2026-04-03T08:00:00.000Z');
  });

  it('converts Moscow (UTC+3) 11:00 → 08:00 UTC (same moment as Krasnoyarsk 15:00)', () => {
    const result = localDateTimeToUtcIso('2026-04-03', '11:00', 'Europe/Moscow');
    expect(result).toBe('2026-04-03T08:00:00.000Z');
  });

  it('handles 00:05 boundary — UTC+7 midnight crosses to previous day UTC', () => {
    const result = localDateTimeToUtcIso('2026-04-03', '00:05', 'Asia/Krasnoyarsk');
    // 00:05 UTC+7 = 2026-04-02T17:05:00Z
    expect(result).toBe('2026-04-02T17:05:00.000Z');
  });

  it('handles 23:55 boundary — UTC+7 near midnight', () => {
    const result = localDateTimeToUtcIso('2026-04-03', '23:55', 'Asia/Krasnoyarsk');
    // 23:55 UTC+7 = 2026-04-03T16:55:00Z
    expect(result).toBe('2026-04-03T16:55:00.000Z');
  });

  it('handles negative offset timezone (UTC-5, New York EST)', () => {
    // April — EDT (UTC-4), not EST
    const result = localDateTimeToUtcIso('2026-04-03', '10:00', 'America/New_York');
    // EDT: 10:00 - (-4) = 14:00 UTC
    expect(result).toBe('2026-04-03T14:00:00.000Z');
  });

  it('handles UTC timezone', () => {
    const result = localDateTimeToUtcIso('2026-04-03', '10:00', 'UTC');
    expect(result).toBe('2026-04-03T10:00:00.000Z');
  });

  it('handles time with seconds', () => {
    const result = localDateTimeToUtcIso('2026-04-03', '15:00:30', 'Asia/Krasnoyarsk');
    expect(result).toBe('2026-04-03T08:00:30.000Z');
  });
});

describe('formatDateInTimezone / formatTimeInTimezone', () => {
  it('shows correct date in UTC+7 for a UTC timestamp', () => {
    // 2026-04-02T17:05:00Z = 2026-04-03 00:05 in Krasnoyarsk (UTC+7)
    const utcDate = new Date('2026-04-02T17:05:00.000Z');
    expect(formatDateInTimezone(utcDate, 'Asia/Krasnoyarsk')).toBe('2026-04-03');
    expect(formatTimeInTimezone(utcDate, 'Asia/Krasnoyarsk')).toBe('00:05');
  });

  it('shows correct date in Moscow for same UTC timestamp', () => {
    // 2026-04-02T17:05:00Z = 2026-04-02 20:05 in Moscow (UTC+3)
    const utcDate = new Date('2026-04-02T17:05:00.000Z');
    expect(formatDateInTimezone(utcDate, 'Europe/Moscow')).toBe('2026-04-02');
    expect(formatTimeInTimezone(utcDate, 'Europe/Moscow')).toBe('20:05');
  });

  it('creator UTC+7 and viewer Moscow see different local times for same meeting', () => {
    // Creator in UTC+7 creates meeting at 15:00 local → 08:00 UTC
    const utcIso = localDateTimeToUtcIso('2026-04-03', '15:00', 'Asia/Krasnoyarsk');
    const utcDate = new Date(utcIso);

    // Creator sees 15:00
    expect(formatTimeInTimezone(utcDate, 'Asia/Krasnoyarsk')).toBe('15:00');
    expect(formatDateInTimezone(utcDate, 'Asia/Krasnoyarsk')).toBe('2026-04-03');

    // Moscow viewer sees 11:00
    expect(formatTimeInTimezone(utcDate, 'Europe/Moscow')).toBe('11:00');
    expect(formatDateInTimezone(utcDate, 'Europe/Moscow')).toBe('2026-04-03');
  });
});

describe('getEffectiveTimezone', () => {
  it('returns profile timezone when valid', () => {
    expect(getEffectiveTimezone('Asia/Krasnoyarsk')).toBe('Asia/Krasnoyarsk');
    expect(getEffectiveTimezone('Europe/Moscow')).toBe('Europe/Moscow');
    expect(getEffectiveTimezone('UTC')).toBe('UTC');
  });

  it('falls back to browser timezone for null/undefined', () => {
    const result = getEffectiveTimezone(null);
    // Should not be empty, should be valid IANA
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('Europe/Moscow'); // Not hardcoded Moscow — unless browser is Moscow
  });

  it('falls back to browser timezone for invalid timezone', () => {
    const result = getEffectiveTimezone('Invalid/Timezone');
    expect(result.length).toBeGreaterThan(0);
    // Should be a valid timezone — test by using it
    expect(() => Intl.DateTimeFormat(undefined, { timeZone: result })).not.toThrow();
  });
});

describe('getTimezoneOffsetLabel', () => {
  it('returns UTC+3 for Moscow', () => {
    const label = getTimezoneOffsetLabel('Europe/Moscow');
    expect(label).toBe('UTC+3');
  });

  it('returns UTC+7 for Krasnoyarsk', () => {
    const label = getTimezoneOffsetLabel('Asia/Krasnoyarsk');
    expect(label).toBe('UTC+7');
  });

  it('returns UTC for UTC timezone', () => {
    const label = getTimezoneOffsetLabel('UTC');
    expect(label).toBe('UTC');
  });
});

describe('parseMeetingDateTime', () => {
  it('parses UTC ISO string', () => {
    const d = parseMeetingDateTime('2026-04-03T08:00:00.000Z');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2026-04-03T08:00:00.000Z');
  });

  it('parses timestamptz with offset', () => {
    const d = parseMeetingDateTime('2026-04-03T15:00:00+07:00');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2026-04-03T08:00:00.000Z');
  });

  it('parses naive local string', () => {
    const d = parseMeetingDateTime('2026-04-03T15:00:00');
    expect(d).not.toBeNull();
    expect(d!.getHours()).toBe(15);
    expect(d!.getMinutes()).toBe(0);
  });

  it('returns null for empty string', () => {
    expect(parseMeetingDateTime('')).toBeNull();
  });
});

describe('day boundary edge cases', () => {
  it('00:05 in UTC+7 is previous day in UTC', () => {
    const utcIso = localDateTimeToUtcIso('2026-04-03', '00:05', 'Asia/Krasnoyarsk');
    const d = new Date(utcIso);
    expect(d.getUTCDate()).toBe(2); // April 2 in UTC
    expect(d.getUTCHours()).toBe(17);
    expect(d.getUTCMinutes()).toBe(5);
  });

  it('23:55 in UTC-5 is next day in UTC', () => {
    // April in New York = EDT (UTC-4)
    const utcIso = localDateTimeToUtcIso('2026-04-03', '23:55', 'America/New_York');
    const d = new Date(utcIso);
    // 23:55 EDT = 03:55 UTC next day
    expect(d.getUTCDate()).toBe(4); // April 4 in UTC
    expect(d.getUTCHours()).toBe(3);
    expect(d.getUTCMinutes()).toBe(55);
  });

  it('round-trip: create in UTC+7, display in UTC+7 shows original time', () => {
    const utcIso = localDateTimeToUtcIso('2026-04-03', '00:05', 'Asia/Krasnoyarsk');
    const d = new Date(utcIso);
    expect(formatDateInTimezone(d, 'Asia/Krasnoyarsk')).toBe('2026-04-03');
    expect(formatTimeInTimezone(d, 'Asia/Krasnoyarsk')).toBe('00:05');
  });

  it('round-trip: create at 23:55 in Moscow, display in Moscow', () => {
    const utcIso = localDateTimeToUtcIso('2026-04-03', '23:55', 'Europe/Moscow');
    const d = new Date(utcIso);
    expect(formatDateInTimezone(d, 'Europe/Moscow')).toBe('2026-04-03');
    expect(formatTimeInTimezone(d, 'Europe/Moscow')).toBe('23:55');
  });
});
