-- ШАГ 1: Модифицировать функцию finalize_expired_stage для каскадной деактивации diagnostic_stages
CREATE OR REPLACE FUNCTION public.finalize_expired_stage(stage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Деактивируем родительский этап
  UPDATE parent_stages
  SET is_active = false, updated_at = now()
  WHERE id = stage_id;

  -- НОВОЕ: Каскадно деактивируем связанные diagnostic_stages
  UPDATE diagnostic_stages
  SET is_active = false, updated_at = now()
  WHERE parent_id = stage_id;

  -- НОВОЕ: Каскадно деактивируем связанные meeting_stages
  UPDATE meeting_stages
  SET updated_at = now()
  WHERE parent_id = stage_id;

  -- Снапшотим статусы survey_360_assignments для этого этапа
  UPDATE survey_360_assignments
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('completed', 'expired');

  -- Снапшотим статусы tasks для этого этапа
  UPDATE tasks
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE diagnostic_stage_id IN (
    SELECT id FROM diagnostic_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('completed', 'expired');

  -- Снапшотим статусы one_on_one_meetings для этого этапа
  UPDATE one_on_one_meetings
  SET 
    status_at_stage_end = status,
    stage_end_snapshot_at = now(),
    status = 'expired',
    updated_at = now()
  WHERE stage_id IN (
    SELECT id FROM meeting_stages WHERE parent_id = stage_id
  )
  AND status NOT IN ('approved', 'expired');
END;
$$;

-- ШАГ 2: Модифицировать функцию reopen_expired_stage для каскадной активации diagnostic_stages
CREATE OR REPLACE FUNCTION public.reopen_expired_stage(stage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Активируем родительский этап
  UPDATE parent_stages
  SET is_active = true, updated_at = now()
  WHERE id = stage_id;

  -- НОВОЕ: Каскадно активируем связанные diagnostic_stages
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

-- ШАГ 3: Одноразовый фикс для синхронизации существующих данных
-- Деактивируем diagnostic_stages, у которых parent_stage уже неактивен
UPDATE diagnostic_stages ds
SET is_active = false, updated_at = now()
FROM parent_stages ps
WHERE ds.parent_id = ps.id 
  AND ps.is_active = false 
  AND ds.is_active = true;