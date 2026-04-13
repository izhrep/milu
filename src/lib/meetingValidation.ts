/**
 * Shared validation rules for meeting date/time and participants.
 * When a timezone is provided, comparisons use that timezone via getNowInTimezone.
 * Otherwise falls back to the user's local browser time.
 */

import { getNowInTimezone } from '@/lib/meetingDateTime';

export interface MeetingDateTimeValidation {
  date: string;   // "YYYY-MM-DD"
  time: string;   // "HH:MM"
}

export interface MeetingValidationError {
  field: 'date' | 'time' | 'participants';
  message: string;
}

/**
 * Validate meeting date+time is not in the past (local TZ).
 * Returns error messages or empty array if valid.
 */
export function validateMeetingDateTime(
  date: string,
  time: string,
  options?: { skipPastCheck?: boolean; timezone?: string },
): MeetingValidationError[] {
  const errors: MeetingValidationError[] = [];

  if (!date) {
    errors.push({ field: 'date', message: 'Укажите дату встречи' });
    return errors;
  }
  if (!time) {
    errors.push({ field: 'time', message: 'Укажите время встречи' });
    return errors;
  }

  if (options?.skipPastCheck) return errors;

  // Determine "now" in the correct timezone
  let todayStr: string;
  let nowTime: string;

  if (options?.timezone) {
    const tz = getNowInTimezone(options.timezone);
    todayStr = tz.date;
    nowTime = tz.time;
  } else {
    const now = new Date();
    todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  if (date < todayStr) {
    errors.push({ field: 'date', message: 'Нельзя создать встречу на прошедшую дату' });
  } else if (date === todayStr && time < nowTime) {
    errors.push({ field: 'time', message: 'Нельзя выбрать время, которое уже прошло' });
  }

  return errors;
}

/**
 * Validate that employee and manager are different people.
 */
export function validateMeetingParticipants(
  employeeId: string | undefined,
  managerId: string | undefined,
): MeetingValidationError[] {
  if (employeeId && managerId && employeeId === managerId) {
    return [{ field: 'participants', message: 'Сотрудник и руководитель не могут быть одним человеком' }];
  }
  return [];
}

/**
 * Combined convenience: validate all meeting creation rules.
 */
export function validateMeetingCreation(params: {
  date: string;
  time: string;
  employeeId?: string;
  managerId?: string;
  timezone?: string;
}): MeetingValidationError[] {
  return [
    ...validateMeetingDateTime(params.date, params.time, { timezone: params.timezone }),
    ...validateMeetingParticipants(params.employeeId, params.managerId),
  ];
}

/**
 * Extract errors for a specific field.
 */
export function getFieldError(
  errors: MeetingValidationError[],
  field: MeetingValidationError['field'],
): string | undefined {
  return errors.find(e => e.field === field)?.message;
}
