-- ============================================
-- СИНХРОНИЗАЦИЯ МИГРАЦИЙ 2026 ГОДА
-- Выполнить на production в Supabase SQL Editor
-- ============================================
-- Этот файл содержит только DDL (без INSERT/UPDATE с hardcoded UUID)
-- Миграции: 20260116113854 - 20260129144700
-- ============================================

-- ============================================
-- 1. 20260116113854 - Stage Finalization V2
-- ============================================

-- Добавляем колонки для снапшота статусов при завершении этапа
ALTER TABLE public.survey_360_assignments 
ADD COLUMN IF NOT EXISTS status_at_stage_end TEXT,
ADD COLUMN IF NOT EXISTS stage_end_snapshot_at TIMESTAMPTZ;

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS status_at_stage_end TEXT,
ADD COLUMN IF NOT EXISTS stage_end_snapshot_at TIMESTAMPTZ;

-- Функция финализации истёкших этапов
CREATE OR REPLACE FUNCTION public.finalize_expired_stage(p_stage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- 3. Обновляем meeting_stages (без is_active, только timestamp)
  UPDATE meeting_stages
  SET updated_at = now()
  WHERE parent_id = p_stage_id;

  -- 4. Снапшотим и переводим незавершённые assignments в expired
  --    ВАЖНО: completed и rejected НЕ трогаем (финальные статусы)
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

  -- 5. Снапшотим и переводим незавершённые tasks в expired
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

  -- 6. Снапшотим и переводим незавершённые meetings в expired
  UPDATE one_on_one_meetings
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE stage_id IN (
    SELECT id FROM meeting_stages WHERE parent_id = p_stage_id
  )
  AND status NOT IN ('approved', 'expired');
  
  -- soft_skill_results и hard_skill_results НЕ изменяются (is_draft остаётся как есть)
END;
$$;

-- Функция переоткрытия этапа
CREATE OR REPLACE FUNCTION public.reopen_expired_stage(stage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Активируем родительский этап
  UPDATE parent_stages
  SET is_active = true, updated_at = now()
  WHERE id = stage_id;

  -- Каскадно активируем связанные diagnostic_stages
  UPDATE diagnostic_stages
  SET is_active = true, updated_at = now()
  WHERE parent_id = stage_id;

  -- Восстанавливаем статусы survey_360_assignments из снапшота
  UPDATE survey_360_assignments
  SET 
    status = COALESCE(status_at_stage_end, 'pending'),
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status = 'expired'
  AND stage_end_snapshot_at IS NOT NULL;

  -- Восстанавливаем статусы tasks из снапшота
  UPDATE tasks
  SET 
    status = COALESCE(status_at_stage_end, 'pending'),
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status = 'expired'
  AND stage_end_snapshot_at IS NOT NULL;

  -- Восстанавливаем статусы one_on_one_meetings из снапшота
  UPDATE one_on_one_meetings
  SET 
    status = COALESCE(status_at_stage_end, 'draft'),
    updated_at = now()
  WHERE stage_id IN (
    SELECT id FROM meeting_stages WHERE parent_id = stage_id
  )
  AND status = 'expired'
  AND stage_end_snapshot_at IS NOT NULL;
END;
$$;

-- ============================================
-- 2. 20260116164200 - Trigger для reminder_date
-- ============================================

-- Автоматическое обновление updated_at для parent_stages
DROP TRIGGER IF EXISTS update_parent_stages_updated_at ON parent_stages;
CREATE TRIGGER update_parent_stages_updated_at
  BEFORE UPDATE ON parent_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. 20260116173336 - Meetings Snapshot
-- ============================================

-- Добавляем колонки для снапшота в one_on_one_meetings
ALTER TABLE public.one_on_one_meetings 
ADD COLUMN IF NOT EXISTS status_at_stage_end TEXT,
ADD COLUMN IF NOT EXISTS stage_end_snapshot_at TIMESTAMPTZ;

-- ============================================
-- 4. 20260122034859 - Task Status Expired
-- ============================================

-- Обновляем constraint для статусов задач (добавляем 'expired')
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS check_status;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks 
ADD CONSTRAINT check_status 
CHECK (status IN ('pending', 'in_progress', 'completed', 'expired'));

-- ============================================
-- 5. 20260126105911 - Assignment Unique Constraint
-- ============================================

-- Удаляем старые unique constraints
ALTER TABLE public.survey_360_assignments 
DROP CONSTRAINT IF EXISTS survey_360_assignments_evaluated_evaluating_unique;

ALTER TABLE public.survey_360_assignments 
DROP CONSTRAINT IF EXISTS survey_360_assignments_evaluated_user_id_evaluating_user_id_key;

-- Создаём новый unique constraint с учётом diagnostic_stage_id
ALTER TABLE public.survey_360_assignments 
ADD CONSTRAINT survey_360_assignments_per_stage_unique 
UNIQUE (evaluated_user_id, evaluating_user_id, diagnostic_stage_id);

-- ============================================
-- 6. 20260126110423 - Participant Trigger Update
-- ============================================

-- Функция создания assignments при добавлении участника
CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  manager_user_id uuid;
BEGIN
  -- Получаем руководителя пользователя
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.user_id;
  
  -- Создаем самооценку
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    diagnostic_stage_id,
    assignment_type,
    status,
    approved_at,
    approved_by
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.stage_id,
    'self',
    'approved',
    now(),
    manager_user_id
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id, diagnostic_stage_id) DO NOTHING;
  
  -- Создаем оценку руководителя (если есть)
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      assignment_type,
      status,
      is_manager_participant,
      approved_at,
      approved_by
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      NEW.stage_id,
      'manager',
      'approved',
      true,
      now(),
      manager_user_id
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id, diagnostic_stage_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Убедимся что триггер существует
DROP TRIGGER IF EXISTS on_diagnostic_participant_added ON diagnostic_stage_participants;
CREATE TRIGGER on_diagnostic_participant_added
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION assign_surveys_to_diagnostic_participant();

-- ============================================
-- 7. 20260128124302 - Finalize Cascade Fix
-- ============================================

-- Функция проверки и финализации всех истёкших этапов (для pg_cron)
CREATE OR REPLACE FUNCTION public.check_and_finalize_expired_stages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_stage RECORD;
BEGIN
  -- Находим все этапы, которые истекли, но ещё активны
  FOR expired_stage IN
    SELECT id
    FROM parent_stages
    WHERE is_active = true AND end_date < CURRENT_DATE
  LOOP
    -- Финализируем каждый этап
    PERFORM public.finalize_expired_stage(expired_stage.id);
    
    -- Деактивируем этап
    UPDATE parent_stages
    SET is_active = false, updated_at = now()
    WHERE id = expired_stage.id;
  END LOOP;
END;
$$;

-- ============================================
-- 8. 20260129083403 - pg_cron Extension
-- ============================================

-- Включаем расширение pg_cron (если доступно)
-- ПРИМЕЧАНИЕ: На Supabase это может потребовать активации через Dashboard
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension not available or already enabled';
END;
$$;

-- Создаём cron job для проверки истёкших этапов каждые 5 минут
-- ПРИМЕЧАНИЕ: Выполнить отдельно если pg_cron доступен
-- SELECT cron.schedule(
--   'check-expired-stages',
--   '*/5 * * * *',
--   'SELECT public.check_and_finalize_expired_stages()'
-- );

-- ============================================
-- 9. 20260129144700 - Finalize Parameter Rename
-- ============================================

-- Функция is_stage_expired с параметром stage_id (не deadline_date)
CREATE OR REPLACE FUNCTION public.is_stage_expired(stage_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stage_end_date DATE;
BEGIN
  SELECT ps.end_date INTO stage_end_date
  FROM parent_stages ps
  WHERE ps.id = stage_id;
  
  IF NOT FOUND THEN
    RETURN true; -- Если этап не найден, считаем его завершённым
  END IF;
  
  RETURN stage_end_date < CURRENT_DATE;
END;
$$;

-- ============================================
-- ФИНАЛ: Отметить миграции как выполненные
-- ============================================

-- Регистрируем миграции в schema_migrations чтобы Supabase не пытался их повторно выполнить
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES 
  ('20260116113854', 'stage_finalization_v2', '{}'),
  ('20260116164200', 'trigger_reminder_date', '{}'),
  ('20260116173336', 'meetings_snapshot', '{}'),
  ('20260122034859', 'task_status_expired', '{}'),
  ('20260126105911', 'assignment_unique_constraint', '{}'),
  ('20260126110423', 'participant_trigger', '{}'),
  ('20260128124302', 'finalize_cascade', '{}'),
  ('20260129083403', 'pg_cron', '{}'),
  ('20260129144700', 'finalize_param_rename', '{}')
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- ПРОВЕРКА: Убедиться что всё применилось
-- ============================================

-- Проверить миграции:
-- SELECT version, name FROM supabase_migrations.schema_migrations WHERE version LIKE '2026%' ORDER BY version;

-- Проверить constraint:
-- SELECT conname FROM pg_constraint WHERE conname LIKE '%survey_360%';

-- Проверить функции:
-- SELECT proname FROM pg_proc WHERE proname IN ('finalize_expired_stage', 'reopen_expired_stage', 'check_and_finalize_expired_stages');
