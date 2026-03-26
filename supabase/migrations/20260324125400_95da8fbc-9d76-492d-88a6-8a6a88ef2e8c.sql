
CREATE OR REPLACE FUNCTION public.compute_meeting_status_and_validate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Step 1: Recompute status
  IF NEW.meeting_summary IS NOT NULL AND NEW.meeting_summary != '' THEN
    NEW.status := 'recorded';
  ELSIF NEW.meeting_date IS NOT NULL AND NEW.meeting_date <= now() THEN
    NEW.status := 'awaiting_summary';
  ELSE
    NEW.status := 'scheduled';
  END IF;

  -- Step 2: Validate max 2 non-completed meetings per employee
  IF NEW.status IN ('scheduled', 'awaiting_summary') THEN
    IF (
      SELECT count(*) FROM public.one_on_one_meetings
      WHERE employee_id = NEW.employee_id
        AND status IN ('scheduled', 'awaiting_summary')
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) >= 2 THEN
      RAISE EXCEPTION 'У сотрудника уже есть 2 незавершённые встречи. Сначала зафиксируйте итоги одной из них.';
    END IF;
  END IF;

  -- Update timestamp
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;
