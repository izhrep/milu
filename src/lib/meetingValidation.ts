/**
 * Shared validation rules for meeting date/time and participants.
 * All time comparisons use the user's local timezone.
 */

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
  options?: { skipPastCheck?: boolean },
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

  // Build local Date from date + time
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const meetingLocal = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const now = new Date();

  if (meetingLocal.getTime() < now.getTime()) {
    // Differentiate: is it a past date, or today but past time?
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (date < todayStr) {
      errors.push({ field: 'date', message: 'Нельзя создать встречу на прошедшую дату' });
    } else if (date === todayStr) {
      errors.push({ field: 'time', message: 'Нельзя выбрать время, которое уже прошло' });
    } else {
      errors.push({ field: 'date', message: 'Нельзя создать встречу в прошедшем времени' });
    }
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
}): MeetingValidationError[] {
  return [
    ...validateMeetingDateTime(params.date, params.time),
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
