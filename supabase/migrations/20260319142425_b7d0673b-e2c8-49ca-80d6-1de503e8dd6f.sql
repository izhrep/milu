
-- Idempotent task synchronization on meeting status change
CREATE OR REPLACE FUNCTION public.sync_meeting_tasks_on_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only act when status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- ===== TRANSITION TO scheduled =====
  IF NEW.status = 'scheduled' THEN
    -- Close active meeting_fill_summary tasks for this meeting
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.id
      AND task_type = 'meeting_fill_summary'
      AND status IN ('pending', 'in_progress');

    -- Ensure meeting_scheduled tasks exist for both participants (no duplicates)
    INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
    SELECT uid, NEW.id,
           'Запланирована встреча 1:1',
           'У вас запланирована встреча 1:1',
           'pending', 'meeting_scheduled', 'Встречи 1:1'
    FROM unnest(ARRAY[NEW.employee_id, NEW.manager_id]) AS uid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = NEW.id
        AND t.task_type = 'meeting_scheduled'
        AND t.user_id = uid
        AND t.status IN ('pending', 'in_progress')
    );

    -- Close meeting_plan_new for this employee's manager (a meeting is now active)
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.employee_id
      AND task_type = 'meeting_plan_new'
      AND status IN ('pending', 'in_progress');
  END IF;

  -- ===== TRANSITION TO awaiting_summary =====
  IF NEW.status = 'awaiting_summary' THEN
    -- Close active meeting_scheduled tasks for this meeting
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.id
      AND task_type = 'meeting_scheduled'
      AND status IN ('pending', 'in_progress');

    -- Create meeting_fill_summary for manager (no duplicate)
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = NEW.id
        AND t.task_type = 'meeting_fill_summary'
        AND t.user_id = NEW.manager_id
        AND t.status IN ('pending', 'in_progress')
    ) THEN
      INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
      VALUES (NEW.manager_id, NEW.id,
              'Заполните итоги встречи 1:1',
              'Встреча состоялась, необходимо заполнить итоги',
              'pending', 'meeting_fill_summary', 'Встречи 1:1');
    END IF;

    -- Close meeting_plan_new (meeting is active)
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.employee_id
      AND task_type = 'meeting_plan_new'
      AND status IN ('pending', 'in_progress');
  END IF;

  -- ===== TRANSITION TO recorded =====
  IF NEW.status = 'recorded' THEN
    -- Close active meeting_fill_summary tasks
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.id
      AND task_type = 'meeting_fill_summary'
      AND status IN ('pending', 'in_progress');

    -- Close active meeting_scheduled tasks (safety net)
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.id
      AND task_type = 'meeting_scheduled'
      AND status IN ('pending', 'in_progress');
  END IF;

  RETURN NEW;
END;
$function$;

-- Create the AFTER UPDATE trigger
DROP TRIGGER IF EXISTS trg_sync_meeting_tasks_on_status ON public.one_on_one_meetings;
CREATE TRIGGER trg_sync_meeting_tasks_on_status
  AFTER UPDATE ON public.one_on_one_meetings
  FOR EACH ROW
  EXECUTE FUNCTION sync_meeting_tasks_on_status_change();
