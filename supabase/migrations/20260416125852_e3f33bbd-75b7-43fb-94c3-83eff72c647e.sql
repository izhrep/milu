
CREATE OR REPLACE FUNCTION public.protect_meeting_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Preserve original summary author: if summary_saved_by is already set,
  -- don't let subsequent edits overwrite it (HR edits should not change authorship)
  IF OLD.summary_saved_by IS NOT NULL
     AND NEW.summary_saved_by IS DISTINCT FROM OLD.summary_saved_by
  THEN
    NEW.summary_saved_by := OLD.summary_saved_by;
    -- Also preserve original saved_at timestamp
    NEW.summary_saved_at := OLD.summary_saved_at;
  END IF;

  -- Only fire protection when summary is being changed
  IF OLD.meeting_summary IS NOT NULL
     AND OLD.meeting_summary <> ''
     AND NEW.meeting_summary IS DISTINCT FROM OLD.meeting_summary
  THEN
    -- Allow if user has privileged permission (HRBP/admin)
    IF has_permission(auth.uid(), 'meetings.edit_summary_date') THEN
      RETURN NEW;
    END IF;

    -- Allow if the current user is the original author
    IF OLD.summary_saved_by = auth.uid() THEN
      -- But only if no next meeting exists for this same pair
      IF NOT EXISTS (
        SELECT 1 FROM public.one_on_one_meetings
        WHERE employee_id = OLD.employee_id
          AND manager_id = OLD.manager_id
          AND id <> OLD.id
          AND COALESCE(meeting_date, created_at) > COALESCE(OLD.meeting_date, OLD.created_at)
      ) THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Summary editing locked: a newer meeting exists for this pair.';
    END IF;

    RAISE EXCEPTION 'Summary already saved. Use thread for clarifications.';
  END IF;
  RETURN NEW;
END;
$$;
