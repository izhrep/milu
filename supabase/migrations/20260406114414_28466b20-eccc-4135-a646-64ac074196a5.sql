
-- 1. Update check_task_type constraint to add new HRBP types
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS check_task_type;
ALTER TABLE public.tasks ADD CONSTRAINT check_task_type CHECK (task_type IN (
  'assessment', 'diagnostic_stage', 'survey_360_evaluation',
  'peer_selection', 'peer_approval', 'meeting',
  'meeting_scheduled', 'meeting_fill_summary',
  'meeting_review_summary', 'meeting_plan_new',
  'meeting_regularity_alert', 'meeting_hrbp_summary_available',
  'skill_survey', 'development'
));

-- 2. Update process_meeting_tasks to add meeting_regularity_alert for HRBP
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

  -- meeting_regularity_alert: assigned to HRBP when employee's 1:1 cycle is broken
  -- Same criteria as meeting_plan_new but target is hr_bp_id instead of manager_id
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  SELECT u.hr_bp_id, u.id,
         'Встречи 1:1 выпали из регулярности',
         'По сотруднику ' || COALESCE(u.last_name || ' ' || u.first_name, '') || ' встречи one-to-one выпали из регулярности. Проверь кейс в Milu.',
         'pending', 'meeting_regularity_alert', 'Встречи 1:1'
  FROM public.users u
  JOIN public.positions p ON u.position_id = p.id
  JOIN public.position_categories pc ON p.position_category_id = pc.id
  WHERE u.status = true
    AND u.hr_bp_id IS NOT NULL
    AND u.manager_id IS NOT NULL
    AND pc.name NOT ILIKE '%внешн%'
    -- Cycle must be started
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
    -- No existing active task for this HRBP + employee
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = u.id
        AND t.task_type = 'meeting_regularity_alert'
        AND t.user_id = u.hr_bp_id
        AND t.status IN ('pending', 'in_progress')
    );

  -- Auto-close meeting_regularity_alert when regularity is restored
  UPDATE public.tasks
  SET status = 'completed', updated_at = now()
  WHERE task_type = 'meeting_regularity_alert'
    AND status IN ('pending', 'in_progress')
    AND EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.employee_id = tasks.assignment_id
        AND m.status IN ('scheduled', 'awaiting_summary')
    );
END;
$$;

-- 3. Update create_meeting_review_summary_task to also create HRBP task
CREATE OR REPLACE FUNCTION create_meeting_review_summary_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  _hrbp_id uuid;
  _employee_name text;
  _manager_name text;
  _function_url text;
  _anon_key text;
BEGIN
  IF NEW.meeting_summary IS NOT NULL AND NEW.meeting_summary != ''
     AND (OLD.meeting_summary IS NULL OR OLD.meeting_summary = '' OR OLD.meeting_summary IS DISTINCT FROM NEW.meeting_summary)
  THEN
    -- Existing logic: create review task for the other participant
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

    -- NEW: Create HRBP summary available task
    SELECT u.hr_bp_id INTO _hrbp_id
    FROM public.users u
    WHERE u.id = NEW.employee_id AND u.hr_bp_id IS NOT NULL;

    IF _hrbp_id IS NOT NULL THEN
      -- Get names for the task description
      SELECT COALESCE(last_name || ' ' || first_name, '') INTO _manager_name
      FROM public.users WHERE id = NEW.manager_id;
      
      SELECT COALESCE(last_name || ' ' || first_name, '') INTO _employee_name
      FROM public.users WHERE id = NEW.employee_id;

      -- Deduplicate: only create if no active task for this meeting+HRBP
      IF NOT EXISTS (
        SELECT 1 FROM public.tasks
        WHERE assignment_id = NEW.id
          AND task_type = 'meeting_hrbp_summary_available'
          AND user_id = _hrbp_id
          AND status IN ('pending', 'in_progress')
      ) THEN
        INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
        VALUES (_hrbp_id, NEW.id,
                'Итоги встречи 1:1 доступны',
                'По встрече one-to-one между ' || _manager_name || ' и ' || _employee_name || ' внесены итоги. Они доступны в Milu.',
                'pending', 'meeting_hrbp_summary_available', 'Встречи 1:1');
      END IF;

      -- Enqueue Bitrix notification R8 for HRBP
      SELECT decrypted_secret INTO _function_url
        FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
      SELECT decrypted_secret INTO _anon_key
        FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

      IF _function_url IS NOT NULL AND _anon_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := _function_url || '/functions/v1/enqueue-reminder',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || _anon_key
          ),
          body := jsonb_build_object(
            'action', 'hrbp_summary_available',
            'meeting_id', NEW.id::text,
            'hrbp_id', _hrbp_id::text,
            'manager_name', _manager_name,
            'employee_name', _employee_name
          )
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
