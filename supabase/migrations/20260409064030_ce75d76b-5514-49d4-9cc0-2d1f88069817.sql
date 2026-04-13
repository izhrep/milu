
CREATE OR REPLACE FUNCTION public.reschedule_meeting_silent(
  p_meeting_id uuid,
  p_new_date timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _meeting record;
  _uid uuid := auth.uid();
  _conflict_exists boolean;
BEGIN
  -- 1. Fetch meeting and lock row
  SELECT * INTO _meeting
    FROM one_on_one_meetings
    WHERE id = p_meeting_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Meeting not found';
  END IF;

  -- 2. Authorization check (mirrors RLS UPDATE policy from 20260327093010)
  IF NOT (
    _meeting.employee_id = _uid
    OR _meeting.manager_id = _uid
    OR has_permission(_uid, 'meetings.manage')
    OR has_permission(_uid, 'meetings.edit_summary_date')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions';
  END IF;

  -- 3. No-op if date unchanged
  IF _meeting.meeting_date = p_new_date THEN
    RETURN;
  END IF;

  -- 4. Past-date guard
  IF p_new_date <= now() THEN
    RAISE EXCEPTION 'PAST_DATE: Cannot schedule meeting in the past';
  END IF;

  -- 5. Conflict check: no other active meeting for same employee at same date/time
  SELECT EXISTS (
    SELECT 1 FROM one_on_one_meetings
    WHERE employee_id = _meeting.employee_id
      AND id <> p_meeting_id
      AND meeting_date = p_new_date
      AND status IN ('scheduled', 'awaiting_summary')
  ) INTO _conflict_exists;

  IF _conflict_exists THEN
    RAISE EXCEPTION 'CONFLICT: Employee already has an active meeting at this date/time';
  END IF;

  -- 6. Handle legacy case: meeting_date IS NULL
  IF _meeting.meeting_date IS NOT NULL THEN
    INSERT INTO meeting_reschedules (meeting_id, previous_date, new_date, rescheduled_by)
    VALUES (p_meeting_id, _meeting.meeting_date, p_new_date, _uid);
  END IF;

  -- 7. Update meeting date (triggers notify_meeting_change once)
  UPDATE one_on_one_meetings
    SET meeting_date = p_new_date
    WHERE id = p_meeting_id;
END;
$$;
