/**
 * Unified meeting status utility.
 *
 * The DB column `one_on_one_meetings.status` is the source of truth, but
 * pg_cron may lag behind real time. This module provides a client-side
 * "effective status" that corrects for the lag by checking `meeting_date`
 * against `Date.now()`.
 */

export type MeetingDbStatus = 'scheduled' | 'awaiting_summary' | 'recorded';

/**
 * Compute effective meeting status client-side.
 * If DB says 'scheduled' but meeting_date is in the past and no summary
 * has been saved yet — treat as 'awaiting_summary'.
 */
export const getEffectiveMeetingStatus = (
  meeting: { status: string; meeting_date: string | null; meeting_summary?: string | null },
): string => {
  if (meeting.status === 'recorded') return 'recorded';
  if (meeting.status === 'scheduled' && meeting.meeting_date && !meeting.meeting_summary) {
    const meetingTime = new Date(meeting.meeting_date).getTime();
    if (!Number.isNaN(meetingTime) && meetingTime <= Date.now()) {
      return 'awaiting_summary';
    }
  }
  return meeting.status;
};

/** Human-readable Russian label for a meeting status. */
export const getMeetingStatusLabel = (status: string): string => {
  switch (status) {
    case 'scheduled': return 'Запланирована';
    case 'awaiting_summary': return 'Ожидает итогов';
    case 'recorded': return 'Зафиксирована';
    default: return status;
  }
};

/** Badge variant for shadcn Badge component. */
export const getMeetingStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' => {
  switch (status) {
    case 'recorded': return 'default';
    case 'awaiting_summary': return 'destructive';
    default: return 'secondary';
  }
};

/** Full badge config (label + variant + icon name) for meeting cards. */
export const getMeetingStatusBadgeConfig = (status: string) => {
  const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    scheduled: { label: 'Запланирована', variant: 'secondary' },
    awaiting_summary: { label: 'Ожидает итогов', variant: 'destructive' },
    recorded: { label: 'Зафиксирована', variant: 'default' },
  };
  return configs[status] || configs.scheduled;
};
