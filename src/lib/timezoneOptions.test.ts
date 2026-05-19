import { describe, it, expect } from 'vitest';
import { getTimezoneOffsetLabel } from '@/lib/meetingDateTime';

/**
 * DST tests for European timezone offset labels.
 * January = winter time, July = summer time (DST).
 */

const JAN = new Date('2026-01-15T12:00:00Z');
const JUL = new Date('2026-07-15T12:00:00Z');

describe('getTimezoneOffsetLabel — DST awareness', () => {
  it('Europe/Berlin: UTC+1 in winter, UTC+2 in summer', () => {
    expect(getTimezoneOffsetLabel('Europe/Berlin', JAN)).toBe('UTC+1');
    expect(getTimezoneOffsetLabel('Europe/Berlin', JUL)).toBe('UTC+2');
  });

  it('Europe/Paris: UTC+1 in winter, UTC+2 in summer', () => {
    expect(getTimezoneOffsetLabel('Europe/Paris', JAN)).toBe('UTC+1');
    expect(getTimezoneOffsetLabel('Europe/Paris', JUL)).toBe('UTC+2');
  });

  it('Europe/London: UTC in winter, UTC+1 in summer', () => {
    expect(getTimezoneOffsetLabel('Europe/London', JAN)).toBe('UTC');
    expect(getTimezoneOffsetLabel('Europe/London', JUL)).toBe('UTC+1');
  });

  it('Europe/Moscow: always UTC+3 (no DST)', () => {
    expect(getTimezoneOffsetLabel('Europe/Moscow', JAN)).toBe('UTC+3');
    expect(getTimezoneOffsetLabel('Europe/Moscow', JUL)).toBe('UTC+3');
  });

  it('Europe/Kyiv: UTC+2 in winter, UTC+3 in summer', () => {
    expect(getTimezoneOffsetLabel('Europe/Kyiv', JAN)).toBe('UTC+2');
    expect(getTimezoneOffsetLabel('Europe/Kyiv', JUL)).toBe('UTC+3');
  });

  it('Europe/Helsinki: UTC+2 in winter, UTC+3 in summer', () => {
    expect(getTimezoneOffsetLabel('Europe/Helsinki', JAN)).toBe('UTC+2');
    expect(getTimezoneOffsetLabel('Europe/Helsinki', JUL)).toBe('UTC+3');
  });
});
