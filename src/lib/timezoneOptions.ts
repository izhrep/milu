/**
 * Centralized timezone list and helpers for UI selectors.
 *
 * Rules:
 * - Labels are built dynamically via getTimezoneOffsetLabel (DST-aware).
 * - Zones grouped by region: Russia, CIS, Europe.
 * - If a user has a saved IANA zone not in this list, it is shown as a fallback option.
 */

import { getTimezoneOffsetLabel } from '@/lib/meetingDateTime';

export type TimezoneRegion = 'russia' | 'cis' | 'europe';

export interface TimezoneEntry {
  value: string;
  city: string;
  region: TimezoneRegion;
}

/** Static registry — labels are computed at render time. */
const TIMEZONE_REGISTRY: TimezoneEntry[] = [
  // Russia
  { value: 'Europe/Kaliningrad', city: 'Калининград', region: 'russia' },
  { value: 'Europe/Moscow', city: 'Москва', region: 'russia' },
  { value: 'Europe/Samara', city: 'Самара', region: 'russia' },
  { value: 'Asia/Yekaterinburg', city: 'Екатеринбург', region: 'russia' },
  { value: 'Asia/Omsk', city: 'Омск', region: 'russia' },
  { value: 'Asia/Krasnoyarsk', city: 'Красноярск', region: 'russia' },
  { value: 'Asia/Irkutsk', city: 'Иркутск', region: 'russia' },
  { value: 'Asia/Yakutsk', city: 'Якутск', region: 'russia' },
  { value: 'Asia/Vladivostok', city: 'Владивосток', region: 'russia' },
  { value: 'Asia/Magadan', city: 'Магадан', region: 'russia' },
  { value: 'Asia/Kamchatka', city: 'Камчатка', region: 'russia' },

  // CIS
  { value: 'Europe/Minsk', city: 'Минск', region: 'cis' },
  { value: 'Asia/Almaty', city: 'Алматы', region: 'cis' },
  { value: 'Asia/Tashkent', city: 'Ташкент', region: 'cis' },

  // Europe
  { value: 'Europe/London', city: 'Лондон', region: 'europe' },
  { value: 'Europe/Dublin', city: 'Дублин', region: 'europe' },
  { value: 'Europe/Lisbon', city: 'Лиссабон', region: 'europe' },
  { value: 'Europe/Berlin', city: 'Берлин', region: 'europe' },
  { value: 'Europe/Paris', city: 'Париж', region: 'europe' },
  { value: 'Europe/Amsterdam', city: 'Амстердам', region: 'europe' },
  { value: 'Europe/Madrid', city: 'Мадрид', region: 'europe' },
  { value: 'Europe/Rome', city: 'Рим', region: 'europe' },
  { value: 'Europe/Warsaw', city: 'Варшава', region: 'europe' },
  { value: 'Europe/Prague', city: 'Прага', region: 'europe' },
  { value: 'Europe/Vienna', city: 'Вена', region: 'europe' },
  { value: 'Europe/Budapest', city: 'Будапешт', region: 'europe' },
  { value: 'Europe/Zurich', city: 'Цюрих', region: 'europe' },
  { value: 'Europe/Stockholm', city: 'Стокгольм', region: 'europe' },
  { value: 'Europe/Oslo', city: 'Осло', region: 'europe' },
  { value: 'Europe/Copenhagen', city: 'Копенгаген', region: 'europe' },
  { value: 'Europe/Helsinki', city: 'Хельсинки', region: 'europe' },
  { value: 'Europe/Riga', city: 'Рига', region: 'europe' },
  { value: 'Europe/Tallinn', city: 'Таллин', region: 'europe' },
  { value: 'Europe/Vilnius', city: 'Вильнюс', region: 'europe' },
  { value: 'Europe/Bucharest', city: 'Бухарест', region: 'europe' },
  { value: 'Europe/Athens', city: 'Афины', region: 'europe' },
  { value: 'Europe/Istanbul', city: 'Стамбул', region: 'europe' },
  { value: 'Europe/Kyiv', city: 'Киев', region: 'europe' },
];

export const REGION_LABELS: Record<TimezoneRegion, string> = {
  russia: 'Россия',
  cis: 'СНГ',
  europe: 'Европа',
};

export const REGION_ORDER: TimezoneRegion[] = ['russia', 'cis', 'europe'];

/** Build a display label like "Берлин (UTC+2)" with current DST offset. */
export function buildTimezoneLabel(entry: TimezoneEntry): string {
  return `${entry.city} (${getTimezoneOffsetLabel(entry.value)})`;
}

/** Full option with computed label. */
export interface TimezoneOption {
  value: string;
  label: string;
  region: TimezoneRegion;
}

/** Get all timezone options grouped by region, with dynamic DST-aware labels. */
export function getTimezoneOptions(): TimezoneOption[] {
  return TIMEZONE_REGISTRY.map((entry) => ({
    value: entry.value,
    label: buildTimezoneLabel(entry),
    region: entry.region,
  }));
}

/** Get grouped options for Select with optgroup-style rendering. */
export function getGroupedTimezoneOptions(): { region: TimezoneRegion; label: string; options: TimezoneOption[] }[] {
  const all = getTimezoneOptions();
  return REGION_ORDER.map((region) => ({
    region,
    label: REGION_LABELS[region],
    options: all.filter((o) => o.region === region),
  }));
}

/**
 * If the user's current timezone is not in the registry (e.g. Europe/Kiev legacy,
 * or an auto-detected exotic zone), return a fallback option for it.
 * Returns null if the zone is already in the list.
 */
export function getFallbackOption(currentValue: string): TimezoneOption | null {
  if (!currentValue) return null;
  const exists = TIMEZONE_REGISTRY.some((e) => e.value === currentValue);
  if (exists) return null;
  return {
    value: currentValue,
    label: `${currentValue} (${getTimezoneOffsetLabel(currentValue)})`,
    region: 'europe', // arbitrary, shown separately
  };
}
