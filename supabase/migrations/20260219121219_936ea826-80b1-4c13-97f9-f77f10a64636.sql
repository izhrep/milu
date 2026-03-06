
-- =============================================
-- CR: Отвязка 1:1 от этапности + обновление формы
-- =============================================

-- 1. one_on_one_meetings: make stage_id nullable, add new columns
ALTER TABLE public.one_on_one_meetings 
  ALTER COLUMN stage_id DROP NOT NULL;

ALTER TABLE public.one_on_one_meetings 
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS ideas_and_suggestions TEXT,
  ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- 2. Partial unique index: only one open meeting per employee-manager pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_meeting_per_pair
  ON public.one_on_one_meetings (employee_id, manager_id)
  WHERE status IN ('draft', 'submitted', 'returned');

-- 3. meeting_status_current table (current status snapshot, not history)
CREATE TABLE IF NOT EXISTS public.meeting_status_current (
  meeting_id UUID PRIMARY KEY REFERENCES public.one_on_one_meetings(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  status_updated_by UUID REFERENCES auth.users(id),
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  mode TEXT NOT NULL DEFAULT 'stage' -- 'stage' or 'stage_less'
);

ALTER TABLE public.meeting_status_current ENABLE ROW LEVEL SECURITY;

-- RLS: participants + admins can SELECT
CREATE POLICY "meeting_status_current_select" ON public.meeting_status_current
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM one_on_one_meetings m
      WHERE m.id = meeting_id
      AND (m.employee_id = auth.uid() OR m.manager_id = auth.uid())
    )
    OR has_permission('meetings.manage')
    OR has_permission('meetings.view_all')
  );

-- No direct INSERT/UPDATE from clients; done via trigger

-- 4. Trigger: upsert meeting_status_current on status change
CREATE OR REPLACE FUNCTION public.upsert_meeting_status_current()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO meeting_status_current (meeting_id, status, status_updated_by, status_updated_at, reason, mode)
  VALUES (
    NEW.id,
    NEW.status,
    COALESCE(auth.uid(), NEW.created_by),
    now(),
    CASE WHEN NEW.status = 'returned' THEN NEW.return_reason ELSE NULL END,
    CASE WHEN NEW.stage_id IS NULL THEN 'stage_less' ELSE 'stage' END
  )
  ON CONFLICT (meeting_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    status_updated_by = EXCLUDED.status_updated_by,
    status_updated_at = EXCLUDED.status_updated_at,
    reason = EXCLUDED.reason,
    mode = EXCLUDED.mode;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_upsert_meeting_status_current
  AFTER INSERT OR UPDATE OF status ON public.one_on_one_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.upsert_meeting_status_current();

-- 5. Trigger: create task for stage-less meetings
CREATE OR REPLACE FUNCTION public.create_stageless_meeting_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.stage_id IS NULL THEN
    INSERT INTO tasks (
      user_id,
      title,
      description,
      status,
      task_type,
      category,
      deadline,
      priority
    ) VALUES (
      NEW.employee_id,
      'Встреча 1:1',
      'Заполните форму встречи 1:1 с руководителем',
      'pending',
      'meeting',
      'Встречи 1:1',
      NEW.meeting_date::date,
      'normal'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_stageless_meeting_task
  AFTER INSERT ON public.one_on_one_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.create_stageless_meeting_task();

-- 6. expire_stageless_meetings function (for pg_cron)
CREATE OR REPLACE FUNCTION public.expire_stageless_meetings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE one_on_one_meetings
  SET
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE stage_id IS NULL
    AND meeting_date IS NOT NULL
    AND meeting_date < now()
    AND status IN ('draft', 'submitted', 'returned');
END;
$$;

-- 7. Update finalize_expired_stage to exclude stage-less meetings
CREATE OR REPLACE FUNCTION public.finalize_expired_stage(p_stage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- 1. Деактивируем родительский этап
  UPDATE parent_stages
  SET is_active = false, updated_at = now()
  WHERE id = p_stage_id;

  -- 2. Каскадно деактивируем связанные diagnostic_stages
  UPDATE diagnostic_stages
  SET is_active = false, updated_at = now()
  WHERE parent_id = p_stage_id;

  -- 3. Обновляем meeting_stages
  UPDATE meeting_stages
  SET updated_at = now()
  WHERE parent_id = p_stage_id;

  -- 4. Снапшотим assignments
  UPDATE survey_360_assignments
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = p_stage_id
  )
  AND status NOT IN ('completed', 'expired', 'rejected');

  -- 5. Снапшотим tasks (только stage-based)
  UPDATE tasks
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = p_stage_id
  )
  AND status NOT IN ('completed', 'expired');

  -- 6. Снапшотим meetings (только stage-based, WHERE stage_id IS NOT NULL)
  UPDATE one_on_one_meetings
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE stage_id IS NOT NULL
  AND stage_id IN (
    SELECT id FROM meeting_stages WHERE parent_id = p_stage_id
  )
  AND status NOT IN ('approved', 'expired');
END;
$$;

-- 8. Update RLS INSERT policy to allow manager creation
DROP POLICY IF EXISTS "one_on_one_meetings_insert_auth_policy" ON public.one_on_one_meetings;
CREATE POLICY "one_on_one_meetings_insert_auth_policy" ON public.one_on_one_meetings
  FOR INSERT WITH CHECK (
    employee_id = auth.uid()
    OR manager_id = auth.uid()
    OR has_permission('meetings.manage')
  );
