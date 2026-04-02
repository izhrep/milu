-- Fix: when summary_saved_by is neither employee nor manager (HRBP case),
-- create review tasks for BOTH participants
CREATE OR REPLACE FUNCTION public.create_meeting_review_summary_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_hrbp_edit boolean;
BEGIN
  IF NEW.meeting_summary IS NOT NULL AND NEW.meeting_summary != ''
     AND (OLD.meeting_summary IS NULL OR OLD.meeting_summary = '' OR OLD.meeting_summary IS DISTINCT FROM NEW.meeting_summary)
  THEN
    NEW.summary_version := COALESCE(OLD.summary_version, 0) + 1;

    is_hrbp_edit := (NEW.summary_saved_by IS NULL
                     OR (NEW.summary_saved_by IS DISTINCT FROM NEW.manager_id
                         AND NEW.summary_saved_by IS DISTINCT FROM NEW.employee_id));

    IF is_hrbp_edit THEN
      UPDATE public.tasks SET status = 'completed', updated_at = now()
      WHERE assignment_id = NEW.id AND task_type = 'meeting_review_summary'
        AND user_id IN (NEW.employee_id, NEW.manager_id)
        AND status IN ('pending', 'in_progress');

      INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
      VALUES
        (NEW.employee_id, NEW.id, 'Ознакомьтесь с итогом встречи 1:1',
         'HR внёс изменения в итоги встречи, пожалуйста, ознакомьтесь с ними',
         'pending', 'meeting_review_summary', 'Встречи 1:1'),
        (NEW.manager_id, NEW.id, 'Ознакомьтесь с итогом встречи 1:1',
         'HR внёс изменения в итоги встречи, пожалуйста, ознакомьтесь с ними',
         'pending', 'meeting_review_summary', 'Встречи 1:1');
    ELSE
      IF NEW.summary_saved_by = NEW.manager_id THEN
        UPDATE public.tasks SET status = 'completed', updated_at = now()
        WHERE assignment_id = NEW.id AND task_type = 'meeting_review_summary'
          AND user_id = NEW.employee_id AND status IN ('pending', 'in_progress');

        INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
        VALUES (NEW.employee_id, NEW.id, 'Ознакомьтесь с итогом встречи 1:1',
                'Итоги встречи обновлены, пожалуйста, ознакомьтесь с ними',
                'pending', 'meeting_review_summary', 'Встречи 1:1');
      ELSE
        UPDATE public.tasks SET status = 'completed', updated_at = now()
        WHERE assignment_id = NEW.id AND task_type = 'meeting_review_summary'
          AND user_id = NEW.manager_id AND status IN ('pending', 'in_progress');

        INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
        VALUES (NEW.manager_id, NEW.id, 'Ознакомьтесь с итогом встречи 1:1',
                'Итоги встречи обновлены, пожалуйста, ознакомьтесь с ними',
                'pending', 'meeting_review_summary', 'Встречи 1:1');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;