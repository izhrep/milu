-- =====================================================
-- МИГРАЦИЯ: Логика завершения этапа диагностики v2
-- =====================================================

-- 1. Переименование deadline_date → reminder_date в parent_stages
ALTER TABLE public.parent_stages 
RENAME COLUMN deadline_date TO reminder_date;

-- 2. Добавление полей для снимков статуса при завершении этапа

-- 2.1. Для survey_360_assignments
ALTER TABLE public.survey_360_assignments
ADD COLUMN IF NOT EXISTS status_at_stage_end TEXT,
ADD COLUMN IF NOT EXISTS stage_end_snapshot_at TIMESTAMP WITH TIME ZONE;

-- 2.2. Для tasks
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS status_at_stage_end TEXT,
ADD COLUMN IF NOT EXISTS stage_end_snapshot_at TIMESTAMP WITH TIME ZONE;

-- 3. Обновление функции check_and_deactivate_expired_stages
-- Теперь деактивация происходит по end_date, а не по reminder_date
CREATE OR REPLACE FUNCTION public.check_and_deactivate_expired_stages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Деактивируем этапы, у которых end_date прошел (жёсткое закрытие)
  UPDATE parent_stages
  SET is_active = false, updated_at = now()
  WHERE is_active = true AND end_date < CURRENT_DATE;
END;
$$;

-- 4. Функция для финализации данных при завершении этапа
CREATE OR REPLACE FUNCTION public.finalize_expired_stage(stage_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_stage RECORD;
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
  DECLARE
    diag_stage_id UUID;
  BEGIN
    SELECT ds.id INTO diag_stage_id
    FROM diagnostic_stages ds
    WHERE ds.parent_id = stage_id
    LIMIT 1;
    
    IF diag_stage_id IS NOT NULL THEN
      -- 8.1. Финализация назначений (assignments)
      -- Сохраняем текущий статус в снимок и переводим незавершённые в expired
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
      
      -- 8.3. Финализация задач (tasks)
      -- Сохраняем текущий статус в снимок и переводим незавершённые в expired
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
  END;
END;
$$;

-- 5. Функция для переоткрытия этапа администратором (раздел 8.0)
CREATE OR REPLACE FUNCTION public.reopen_expired_stage(stage_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  diag_stage_id UUID;
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
END;
$$;

-- 6. Функция проверки, завершён ли этап (для использования в RLS и UI)
CREATE OR REPLACE FUNCTION public.is_stage_expired(stage_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

-- 7. Функция для автоматической финализации при загрузке данных
CREATE OR REPLACE FUNCTION public.check_and_finalize_expired_stages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 8. Комментарии к полям
COMMENT ON COLUMN parent_stages.reminder_date IS 'Дата напоминания - используется для коммуникаций/напоминаний, не завершает этап';
COMMENT ON COLUMN parent_stages.end_date IS 'Конечная дата этапа (hard close) - после неё этап считается завершённым';
COMMENT ON COLUMN survey_360_assignments.status_at_stage_end IS 'Статус на момент завершения этапа - для восстановления при переоткрытии';
COMMENT ON COLUMN survey_360_assignments.stage_end_snapshot_at IS 'Дата/время создания снимка статуса';
COMMENT ON COLUMN tasks.status_at_stage_end IS 'Статус на момент завершения этапа - для восстановления при переоткрытии';
COMMENT ON COLUMN tasks.stage_end_snapshot_at IS 'Дата/время создания снимка статуса';