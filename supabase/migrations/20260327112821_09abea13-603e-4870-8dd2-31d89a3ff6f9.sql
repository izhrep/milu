-- Fix: close meeting_plan_new on INSERT (new meeting created for employee)
CREATE OR REPLACE FUNCTION public.create_meeting_scheduled_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Close any pending meeting_plan_new for this employee (a meeting now exists)
  UPDATE public.tasks
  SET status = 'completed', updated_at = now()
  WHERE assignment_id = NEW.employee_id
    AND task_type = 'meeting_plan_new'
    AND status IN ('pending', 'in_progress');

  RETURN NEW;
END;
$function$;

-- Fix: add stale meeting_plan_new cleanup to cron function
CREATE OR REPLACE FUNCTION public.process_meeting_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Close stale meeting_plan_new: employee already has an active meeting
  UPDATE public.tasks
  SET status = 'completed', updated_at = now()
  WHERE task_type = 'meeting_plan_new'
    AND status IN ('pending', 'in_progress')
    AND EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.employee_id = tasks.assignment_id
        AND m.status IN ('scheduled', 'awaiting_summary')
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
    AND EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m WHERE m.employee_id = u.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.employee_id = u.id
        AND m.status IN ('scheduled', 'awaiting_summary')
    )
    AND (
      SELECT MAX(COALESCE(m.meeting_date, m.updated_at))
      FROM public.one_on_one_meetings m
      WHERE m.employee_id = u.id AND m.status = 'recorded'
    ) < now() - interval '35 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = u.id
        AND t.task_type = 'meeting_plan_new'
        AND t.user_id = u.manager_id
        AND t.status IN ('pending', 'in_progress')
    );
END;
$function$;