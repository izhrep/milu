
-- Fix process_meeting_tasks: 
-- 1. meeting_plan_new → assign to MANAGER, not employee
-- 2. Only for employees who already have at least 1 meeting (cycle started)
-- 3. Exclude external employees (position_category contains 'внешн')
-- 4. Remove ::text casts - assignment_id is uuid
CREATE OR REPLACE FUNCTION process_meeting_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create meeting_fill_summary tasks for awaiting_summary meetings (for manager only)
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  SELECT m.manager_id, m.id,
         'Заполните итоги встречи 1:1',
         'Встреча состоялась, необходимо заполнить итоги',
         'pending', 'meeting_fill_summary', 'Встречи 1:1'
  FROM public.one_on_one_meetings m
  WHERE m.status = 'awaiting_summary'
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = m.id
        AND t.task_type = 'meeting_fill_summary'
        AND t.user_id = m.manager_id
        AND t.status IN ('pending', 'in_progress')
    );

  -- Close meeting_scheduled tasks when meeting is no longer scheduled
  UPDATE public.tasks
  SET status = 'completed', updated_at = now()
  WHERE task_type = 'meeting_scheduled'
    AND status IN ('pending', 'in_progress')
    AND NOT EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id = tasks.assignment_id
        AND m.status = 'scheduled'
    );

  -- Close meeting_fill_summary tasks when meeting becomes recorded
  UPDATE public.tasks
  SET status = 'completed', updated_at = now()
  WHERE task_type = 'meeting_fill_summary'
    AND status IN ('pending', 'in_progress')
    AND EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id = tasks.assignment_id
        AND m.status = 'recorded'
    );

  -- meeting_plan_new: assigned to MANAGER, only for internal employees with cycle started
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  SELECT u.manager_id, u.id,
         'Запланируйте встречу 1:1',
         'Прошло более 35 дней с последней встречи с ' || COALESCE(u.last_name || ' ' || u.first_name, 'сотрудником'),
         'pending', 'meeting_plan_new', 'Встречи 1:1'
  FROM public.users u
  JOIN public.positions p ON u.position_id = p.id
  JOIN public.position_categories pc ON p.position_category_id = pc.id
  WHERE u.status = true
    AND u.manager_id IS NOT NULL
    AND pc.name NOT ILIKE '%внешн%'
    -- Cycle must be started (at least 1 meeting exists)
    AND EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m WHERE m.employee_id = u.id
    )
    -- No active scheduled or awaiting_summary meeting
    AND NOT EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.employee_id = u.id
        AND m.status IN ('scheduled', 'awaiting_summary')
    )
    -- Last recorded meeting older than 35 days
    AND (
      SELECT MAX(COALESCE(m.meeting_date, m.updated_at))
      FROM public.one_on_one_meetings m
      WHERE m.employee_id = u.id AND m.status = 'recorded'
    ) < now() - interval '35 days'
    -- No existing active task
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = u.id
        AND t.task_type = 'meeting_plan_new'
        AND t.user_id = u.manager_id
        AND t.status IN ('pending', 'in_progress')
    );
END;
$$;

-- Also fix create_meeting_scheduled_task trigger to remove unnecessary ::text casts
CREATE OR REPLACE FUNCTION create_meeting_scheduled_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  VALUES
    (NEW.employee_id, NEW.id,
     'Запланирована встреча 1:1',
     'У вас запланирована встреча 1:1',
     'pending', 'meeting_scheduled', 'Встречи 1:1'),
    (NEW.manager_id, NEW.id,
     'Запланирована встреча 1:1',
     'У вас запланирована встреча 1:1',
     'pending', 'meeting_scheduled', 'Встречи 1:1');
  RETURN NEW;
END;
$$;

-- Fix create_meeting_review_summary_task to remove ::text casts
CREATE OR REPLACE FUNCTION create_meeting_review_summary_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NEW.meeting_summary IS NOT NULL AND NEW.meeting_summary != ''
     AND (OLD.meeting_summary IS NULL OR OLD.meeting_summary = '' OR OLD.meeting_summary IS DISTINCT FROM NEW.meeting_summary)
  THEN
    IF NEW.summary_saved_by = NEW.manager_id THEN
      target_user_id := NEW.employee_id;
    ELSE
      target_user_id := NEW.manager_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE assignment_id = NEW.id
        AND task_type = 'meeting_review_summary'
        AND user_id = target_user_id
        AND status IN ('pending', 'in_progress')
    ) THEN
      INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
      VALUES (target_user_id, NEW.id,
              'Ознакомьтесь с итогом встречи 1:1',
              'Ваш коллега зафиксировал итоги встречи',
              'pending', 'meeting_review_summary', 'Встречи 1:1');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
