
-- =====================================================
-- One-to-One Module Rebuild Migration
-- =====================================================

-- 1. New columns on one_on_one_meetings
ALTER TABLE public.one_on_one_meetings
  ADD COLUMN IF NOT EXISTS emp_mood text,
  ADD COLUMN IF NOT EXISTS emp_successes text,
  ADD COLUMN IF NOT EXISTS emp_problems text,
  ADD COLUMN IF NOT EXISTS emp_news text,
  ADD COLUMN IF NOT EXISTS emp_questions text,
  ADD COLUMN IF NOT EXISTS meeting_summary text,
  ADD COLUMN IF NOT EXISTS summary_saved_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS summary_saved_at timestamptz;

-- 2. New table: meeting_manager_fields
CREATE TABLE IF NOT EXISTS public.meeting_manager_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.one_on_one_meetings(id) ON DELETE CASCADE UNIQUE,
  mgr_praise text,
  mgr_development_comment text,
  mgr_news text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.meeting_manager_fields ENABLE ROW LEVEL SECURITY;

-- RLS: SELECT for manager + hr_bp + admin
CREATE POLICY "mmf_select" ON public.meeting_manager_fields FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.one_on_one_meetings m WHERE m.id = meeting_id AND m.manager_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'hr_bp'::app_role))
  );

-- RLS: INSERT for meeting's manager only
CREATE POLICY "mmf_insert" ON public.meeting_manager_fields FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.one_on_one_meetings m WHERE m.id = meeting_id AND m.manager_id = auth.uid())
  );

-- RLS: UPDATE for meeting's manager only
CREATE POLICY "mmf_update" ON public.meeting_manager_fields FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.one_on_one_meetings m WHERE m.id = meeting_id AND m.manager_id = auth.uid())
  );

-- 3. Drop legacy triggers and functions
DROP TRIGGER IF EXISTS trg_upsert_meeting_status_current ON public.one_on_one_meetings;
DROP TRIGGER IF EXISTS trg_create_stageless_meeting_task ON public.one_on_one_meetings;
DROP TRIGGER IF EXISTS trigger_update_meeting_task_status ON public.one_on_one_meetings;

DROP FUNCTION IF EXISTS public.upsert_meeting_status_current() CASCADE;
DROP FUNCTION IF EXISTS public.create_stageless_meeting_task() CASCADE;
DROP FUNCTION IF EXISTS public.update_meeting_task_status() CASCADE;
DROP FUNCTION IF EXISTS public.expire_stageless_meetings() CASCADE;

-- 4. Drop legacy partial unique index
DROP INDEX IF EXISTS public.idx_one_open_meeting_per_pair;

-- 5. Combined compute_meeting_status + duplicate check trigger function
CREATE OR REPLACE FUNCTION public.compute_meeting_status_and_validate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Step 1: Recompute status
  IF NEW.meeting_summary IS NOT NULL AND NEW.meeting_summary != '' THEN
    NEW.status := 'recorded';
  ELSIF NEW.meeting_date IS NOT NULL AND NEW.meeting_date <= now() THEN
    NEW.status := 'awaiting_summary';
  ELSE
    NEW.status := 'scheduled';
  END IF;

  -- Step 2: Validate no duplicate future scheduled meeting for this pair
  IF NEW.status = 'scheduled' THEN
    IF EXISTS (
      SELECT 1 FROM public.one_on_one_meetings
      WHERE employee_id = NEW.employee_id
        AND manager_id = NEW.manager_id
        AND status = 'scheduled'
        AND meeting_date > now()
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'У этой пары уже есть запланированная встреча в будущем';
    END IF;
  END IF;

  -- Update timestamp
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compute_meeting_status
  BEFORE INSERT OR UPDATE ON public.one_on_one_meetings
  FOR EACH ROW EXECUTE FUNCTION public.compute_meeting_status_and_validate();

-- 6. Update protect_meeting_employee_fields to include new employee fields
CREATE OR REPLACE FUNCTION public.protect_meeting_employee_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_user_id uuid := auth.uid();
  is_employee boolean;
BEGIN
  is_employee := (current_user_id = NEW.employee_id);
  IF is_employee THEN
    RETURN NEW;
  END IF;

  -- For non-employees: revert employee-only fields to old values
  NEW.energy_gained := OLD.energy_gained;
  NEW.energy_lost := OLD.energy_lost;
  NEW.previous_decisions_debrief := OLD.previous_decisions_debrief;
  NEW.stoppers := OLD.stoppers;
  NEW.ideas_and_suggestions := OLD.ideas_and_suggestions;
  NEW.emp_mood := OLD.emp_mood;
  NEW.emp_successes := OLD.emp_successes;
  NEW.emp_problems := OLD.emp_problems;
  NEW.emp_news := OLD.emp_news;
  NEW.emp_questions := OLD.emp_questions;

  RETURN NEW;
END;
$$;

-- 7. Create meeting_scheduled task on INSERT
CREATE OR REPLACE FUNCTION public.create_meeting_scheduled_task()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Create task for both employee and manager
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  VALUES
    (NEW.employee_id, NEW.id::text,
     'Запланирована встреча 1:1',
     'У вас запланирована встреча 1:1',
     'pending', 'meeting_scheduled', 'Встречи 1:1'),
    (NEW.manager_id, NEW.id::text,
     'Запланирована встреча 1:1',
     'У вас запланирована встреча 1:1',
     'pending', 'meeting_scheduled', 'Встречи 1:1');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_meeting_scheduled_task
  AFTER INSERT ON public.one_on_one_meetings
  FOR EACH ROW EXECUTE FUNCTION public.create_meeting_scheduled_task();

-- 8. Create meeting_review_summary task on summary save
CREATE OR REPLACE FUNCTION public.create_meeting_review_summary_task()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NEW.meeting_summary IS NOT NULL AND NEW.meeting_summary != ''
     AND (OLD.meeting_summary IS NULL OR OLD.meeting_summary = '' OR OLD.meeting_summary IS DISTINCT FROM NEW.meeting_summary)
  THEN
    -- Determine target: the OTHER party
    IF NEW.summary_saved_by = NEW.manager_id THEN
      target_user_id := NEW.employee_id;
    ELSE
      target_user_id := NEW.manager_id;
    END IF;

    -- Deduplication
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE assignment_id = NEW.id::text
        AND task_type = 'meeting_review_summary'
        AND user_id = target_user_id
        AND status IN ('pending', 'in_progress')
    ) THEN
      INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
      VALUES (target_user_id, NEW.id::text,
              'Ознакомьтесь с итогом встречи 1:1',
              'Ваш коллега зафиксировал итоги встречи',
              'pending', 'meeting_review_summary', 'Встречи 1:1');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_review_summary_task
  AFTER UPDATE OF meeting_summary ON public.one_on_one_meetings
  FOR EACH ROW EXECUTE FUNCTION public.create_meeting_review_summary_task();

-- 9. Update check_task_type constraint to add new types
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS check_task_type;
ALTER TABLE public.tasks ADD CONSTRAINT check_task_type CHECK (task_type IN (
  'assessment', 'diagnostic_stage', 'survey_360_evaluation',
  'peer_selection', 'peer_approval', 'meeting',
  'meeting_scheduled', 'meeting_fill_summary',
  'meeting_review_summary', 'meeting_plan_new',
  'skill_survey', 'development'
));

-- 10. Process meeting status for cron (time-based transitions)
CREATE OR REPLACE FUNCTION public.process_meeting_status()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Touch meetings that should transition from scheduled to awaiting_summary
  -- The BEFORE UPDATE trigger will recompute the status
  UPDATE public.one_on_one_meetings
  SET updated_at = now()
  WHERE status = 'scheduled'
    AND meeting_date IS NOT NULL
    AND meeting_date <= now();
END;
$$;

-- 11. Process meeting tasks for cron
-- Creates meeting_fill_summary tasks when meetings transition to awaiting_summary
-- Creates meeting_plan_new tasks for pairs without a scheduled meeting
CREATE OR REPLACE FUNCTION public.process_meeting_tasks()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Create meeting_fill_summary tasks for awaiting_summary meetings without one
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  SELECT m.employee_id, m.id::text,
         'Заполните итоги встречи 1:1',
         'Встреча состоялась, необходимо заполнить итоги',
         'pending', 'meeting_fill_summary', 'Встречи 1:1'
  FROM public.one_on_one_meetings m
  WHERE m.status = 'awaiting_summary'
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = m.id::text
        AND t.task_type = 'meeting_fill_summary'
        AND t.user_id = m.employee_id
        AND t.status IN ('pending', 'in_progress')
    );

  -- Also for manager
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  SELECT m.manager_id, m.id::text,
         'Заполните итоги встречи 1:1',
         'Встреча состоялась, необходимо заполнить итоги',
         'pending', 'meeting_fill_summary', 'Встречи 1:1'
  FROM public.one_on_one_meetings m
  WHERE m.status = 'awaiting_summary'
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = m.id::text
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
      WHERE m.id::text = tasks.assignment_id
        AND m.status = 'scheduled'
    );

  -- Close meeting_fill_summary tasks when meeting becomes recorded
  UPDATE public.tasks
  SET status = 'completed', updated_at = now()
  WHERE task_type = 'meeting_fill_summary'
    AND status IN ('pending', 'in_progress')
    AND EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.id::text = tasks.assignment_id
        AND m.status = 'recorded'
    );

  -- Create meeting_plan_new tasks for active employee-manager pairs without a future scheduled meeting
  -- Only for pairs where the last recorded meeting is older than 35 days
  INSERT INTO public.tasks (user_id, assignment_id, title, description, status, task_type, category)
  SELECT u.id, u.id::text,
         'Запланируйте встречу 1:1',
         'Прошло более 35 дней с последней встречи',
         'pending', 'meeting_plan_new', 'Встречи 1:1'
  FROM public.users u
  WHERE u.status = true
    AND u.manager_id IS NOT NULL
    -- No active scheduled meeting
    AND NOT EXISTS (
      SELECT 1 FROM public.one_on_one_meetings m
      WHERE m.employee_id = u.id
        AND m.manager_id = u.manager_id
        AND m.status IN ('scheduled', 'awaiting_summary')
    )
    -- Last recorded meeting older than 35 days (or no recorded meeting at all)
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.one_on_one_meetings m
        WHERE m.employee_id = u.id AND m.manager_id = u.manager_id AND m.status = 'recorded'
      )
      OR (
        SELECT MAX(COALESCE(m.meeting_date, m.updated_at))
        FROM public.one_on_one_meetings m
        WHERE m.employee_id = u.id AND m.manager_id = u.manager_id AND m.status = 'recorded'
      ) < now() - interval '35 days'
    )
    -- No existing active task
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.assignment_id = u.id::text
        AND t.task_type = 'meeting_plan_new'
        AND t.user_id = u.id
        AND t.status IN ('pending', 'in_progress')
    );
END;
$$;

-- 12. updated_at trigger for meeting_manager_fields
CREATE TRIGGER update_meeting_manager_fields_updated_at
  BEFORE UPDATE ON public.meeting_manager_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
