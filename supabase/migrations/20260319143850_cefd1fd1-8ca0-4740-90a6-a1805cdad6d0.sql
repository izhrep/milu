
-- Add summary_version to track distinct summary edits
ALTER TABLE public.one_on_one_meetings
  ADD COLUMN IF NOT EXISTS summary_version integer NOT NULL DEFAULT 0;

-- Add summary_acknowledged_version to tasks to track which version was acknowledged
-- We'll use a convention: tasks store the version they were created for

-- Update the trigger to increment version and use it for dedup
CREATE OR REPLACE FUNCTION public.create_meeting_review_summary_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id uuid;
BEGIN
  -- Only act when summary actually changed to a non-empty value
  IF NEW.meeting_summary IS NOT NULL AND NEW.meeting_summary != ''
     AND (OLD.meeting_summary IS NULL OR OLD.meeting_summary = '' OR OLD.meeting_summary IS DISTINCT FROM NEW.meeting_summary)
  THEN
    -- Increment summary version
    NEW.summary_version := COALESCE(OLD.summary_version, 0) + 1;

    -- Determine target: the OTHER participant
    IF NEW.summary_saved_by = NEW.manager_id THEN
      target_user_id := NEW.employee_id;
    ELSE
      target_user_id := NEW.manager_id;
    END IF;

    -- Close any existing active review task for this meeting+target
    -- (it refers to an older version)
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.id
      AND task_type = 'meeting_review_summary'
      AND user_id = target_user_id
      AND status IN ('pending', 'in_progress');

    -- Create fresh task for the new version
    INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
    VALUES (target_user_id, NEW.id,
            'Ознакомьтесь с итогом встречи 1:1',
            'Итоги встречи обновлены, пожалуйста, ознакомьтесь с ними',
            'pending', 'meeting_review_summary', 'Встречи 1:1');
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate as BEFORE trigger so we can modify NEW.summary_version
DROP TRIGGER IF EXISTS trg_create_review_summary_task ON public.one_on_one_meetings;
CREATE TRIGGER trg_create_review_summary_task
  BEFORE UPDATE OF meeting_summary ON public.one_on_one_meetings
  FOR EACH ROW
  EXECUTE FUNCTION create_meeting_review_summary_task();
