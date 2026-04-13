
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
BEGIN
  -- 1. Fetch meeting and lock row
  SELECT * INTO _meeting
    FROM one_on_one_meetings
    WHERE id = p_meeting_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found';
  END IF;

  -- 2. Authorization check (mirrors RLS UPDATE policy from 20260327093010)
  IF NOT (
    _meeting.employee_id = _uid
    OR _meeting.manager_id = _uid
    OR has_permission(_uid, 'meetings.manage')
    OR has_permission(_uid, 'meetings.edit_summary_date')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- 3. No-op if date unchanged
  IF _meeting.meeting_date = p_new_date THEN
    RETURN;
  END IF;

  -- 4. Past-date guard
  IF p_new_date <= now() THEN
    RAISE EXCEPTION 'Cannot schedule meeting in the past';
  END IF;

  -- 5. Handle legacy case: meeting_date IS NULL (previous_date is NOT NULL in meeting_reschedules)
  IF _meeting.meeting_date IS NOT NULL THEN
    INSERT INTO meeting_reschedules (meeting_id, previous_date, new_date, rescheduled_by)
    VALUES (p_meeting_id, _meeting.meeting_date, p_new_date, _uid);
  END IF;

  -- 6. Update meeting date (triggers notify_meeting_change once)
  UPDATE one_on_one_meetings
    SET meeting_date = p_new_date
    WHERE id = p_meeting_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_meeting_silent(uuid, timestamptz) TO authenticated;
