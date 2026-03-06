-- Drop and recreate function with renamed parameter to avoid ambiguity
DROP FUNCTION IF EXISTS public.finalize_expired_stage(uuid);

CREATE OR REPLACE FUNCTION public.finalize_expired_stage(p_stage_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;