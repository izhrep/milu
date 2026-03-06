-- 1. Добавляем поля для снапшота статуса в таблицу one_on_one_meetings
ALTER TABLE one_on_one_meetings
ADD COLUMN IF NOT EXISTS status_at_stage_end TEXT,
ADD COLUMN IF NOT EXISTS stage_end_snapshot_at TIMESTAMPTZ;

-- 2. Обновляем функцию finalize_expired_stage для обработки one_on_one_meetings
CREATE OR REPLACE FUNCTION public.finalize_expired_stage(stage_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_stage RECORD;
  diag_stage_id UUID;
  meet_stage_id UUID;
BEGIN
  -- Получаем информацию о родительском этапе
  SELECT ps.* INTO parent_stage
  FROM parent_stages ps
  WHERE ps.id = stage_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage not found: %', stage_id;
  END IF;
  
  -- Проверяем, что этап завершён (end_date прошла)
  IF parent_stage.end_date >= CURRENT_DATE THEN
    RAISE EXCEPTION 'Stage is not yet expired: end_date is %', parent_stage.end_date;
  END IF;
  
  -- Получаем id диагностического подэтапа
  SELECT ds.id INTO diag_stage_id
  FROM diagnostic_stages ds
  WHERE ds.parent_id = stage_id
  LIMIT 1;
  
  IF diag_stage_id IS NOT NULL THEN
    -- Финализация назначений (assignments)
    UPDATE survey_360_assignments
    SET 
      status_at_stage_end = CASE WHEN status_at_stage_end IS NULL THEN status ELSE status_at_stage_end END,
      stage_end_snapshot_at = CASE WHEN stage_end_snapshot_at IS NULL THEN now() ELSE stage_end_snapshot_at END,
      status = CASE 
        WHEN status IN ('completed', 'rejected') THEN status
        ELSE 'expired'
      END,
      updated_at = now()
    WHERE diagnostic_stage_id = diag_stage_id
      AND status NOT IN ('completed', 'rejected', 'expired');
    
    -- Финализация задач (tasks)
    UPDATE tasks
    SET 
      status_at_stage_end = CASE WHEN status_at_stage_end IS NULL THEN status ELSE status_at_stage_end END,
      stage_end_snapshot_at = CASE WHEN stage_end_snapshot_at IS NULL THEN now() ELSE stage_end_snapshot_at END,
      status = CASE 
        WHEN status = 'completed' THEN status
        ELSE 'expired'
      END,
      updated_at = now()
    WHERE diagnostic_stage_id = diag_stage_id
      AND status != 'completed'
      AND status != 'expired';
  END IF;
  
  -- Получаем id meeting подэтапа
  SELECT ms.id INTO meet_stage_id
  FROM meeting_stages ms
  WHERE ms.parent_id = stage_id
  LIMIT 1;
  
  IF meet_stage_id IS NOT NULL THEN
    -- Финализация one_on_one_meetings
    UPDATE one_on_one_meetings
    SET 
      status_at_stage_end = CASE WHEN status_at_stage_end IS NULL THEN status ELSE status_at_stage_end END,
      stage_end_snapshot_at = CASE WHEN stage_end_snapshot_at IS NULL THEN now() ELSE stage_end_snapshot_at END,
      status = CASE 
        WHEN status = 'approved' THEN status
        ELSE 'expired'
      END,
      updated_at = now()
    WHERE stage_id = meet_stage_id
      AND status != 'approved'
      AND status != 'expired';
  END IF;
END;
$$;

-- 3. Обновляем функцию reopen_expired_stage для восстановления one_on_one_meetings
CREATE OR REPLACE FUNCTION public.reopen_expired_stage(stage_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  diag_stage_id UUID;
  meet_stage_id UUID;
BEGIN
  -- Активируем родительский этап
  UPDATE parent_stages
  SET is_active = true, updated_at = now()
  WHERE id = stage_id;
  
  -- Получаем id диагностического подэтапа
  SELECT ds.id INTO diag_stage_id
  FROM diagnostic_stages ds
  WHERE ds.parent_id = stage_id
  LIMIT 1;
  
  IF diag_stage_id IS NOT NULL THEN
    -- Восстанавливаем статусы назначений из снимка
    UPDATE survey_360_assignments
    SET 
      status = COALESCE(status_at_stage_end, status),
      updated_at = now()
    WHERE diagnostic_stage_id = diag_stage_id
      AND status = 'expired'
      AND status_at_stage_end IS NOT NULL;
    
    -- Восстанавливаем статусы задач из снимка
    UPDATE tasks
    SET 
      status = COALESCE(status_at_stage_end, status),
      updated_at = now()
    WHERE diagnostic_stage_id = diag_stage_id
      AND status = 'expired'
      AND status_at_stage_end IS NOT NULL;
  END IF;
  
  -- Получаем id meeting подэтапа
  SELECT ms.id INTO meet_stage_id
  FROM meeting_stages ms
  WHERE ms.parent_id = stage_id
  LIMIT 1;
  
  IF meet_stage_id IS NOT NULL THEN
    -- Восстанавливаем статусы one_on_one_meetings из снимка
    UPDATE one_on_one_meetings
    SET 
      status = COALESCE(status_at_stage_end, status),
      updated_at = now()
    WHERE stage_id = meet_stage_id
      AND status = 'expired'
      AND status_at_stage_end IS NOT NULL;
  END IF;
END;
$$;