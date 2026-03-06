-- Исправление триггеров и функций для добавления участников диагностики

-- 1. Удаляем все дублирующиеся триггеры на diagnostic_stage_participants
DROP TRIGGER IF EXISTS create_diagnostic_task_trigger ON diagnostic_stage_participants;
DROP TRIGGER IF EXISTS on_diagnostic_participant_added ON diagnostic_stage_participants;
DROP TRIGGER IF EXISTS on_diagnostic_participant_added_create_task ON diagnostic_stage_participants;
DROP TRIGGER IF EXISTS on_diagnostic_participant_added_update_stage ON diagnostic_stage_participants;
DROP TRIGGER IF EXISTS trigger_assign_surveys_to_diagnostic_participant ON diagnostic_stage_participants;
DROP TRIGGER IF EXISTS trigger_assign_surveys_to_participant ON diagnostic_stage_participants;
DROP TRIGGER IF EXISTS trigger_create_diagnostic_task ON diagnostic_stage_participants;
DROP TRIGGER IF EXISTS trigger_update_stage_on_participant_add ON diagnostic_stage_participants;
DROP TRIGGER IF EXISTS update_diagnostic_progress_on_participant ON diagnostic_stage_participants;
DROP TRIGGER IF EXISTS update_diagnostic_stage_on_participant_add_trigger ON diagnostic_stage_participants;

-- 2. Исправляем функцию update_diagnostic_stage_status для работы с обеими таблицами
CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  new_progress numeric;
  new_status text;
  target_user_id uuid;
BEGIN
  -- Определяем user_id в зависимости от таблицы
  IF TG_TABLE_NAME = 'skill_survey_results' THEN
    target_user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'survey_360_results' THEN
    target_user_id := NEW.evaluated_user_id;
  ELSIF TG_TABLE_NAME = 'diagnostic_stage_participants' THEN
    target_user_id := NEW.user_id;
  ELSE
    RETURN NEW;
  END IF;

  -- Находим активный этап для этого участника
  SELECT ds.* INTO stage_record
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = target_user_id
    AND ds.is_active = true
  LIMIT 1;
  
  IF stage_record.id IS NOT NULL THEN
    -- Вычисляем новый прогресс
    new_progress := calculate_diagnostic_stage_progress(stage_record.id);
    
    -- Определяем новый статус
    IF new_progress = 0 THEN
      new_status := 'setup';
    ELSIF new_progress >= 100 THEN
      new_status := 'completed';
    ELSE
      new_status := 'assessment';
    END IF;
    
    -- Обновляем этап
    UPDATE diagnostic_stages
    SET progress_percent = new_progress,
        status = new_status,
        updated_at = now()
    WHERE id = stage_record.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Создаем только необходимые триггеры (по одному на каждую функцию)

-- Триггер для создания заданий при добавлении участника
CREATE TRIGGER on_diagnostic_participant_added
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION assign_surveys_to_diagnostic_participant();

-- Триггер для обновления прогресса при добавлении участника
CREATE TRIGGER on_diagnostic_participant_progress
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnostic_stage_status();

-- Триггер для создания задачи участнику
CREATE TRIGGER on_diagnostic_participant_task
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION create_diagnostic_task_for_participant();

-- Комментарий: Функция update_diagnostic_stage_on_participant_add() дублирует логику,
-- поэтому используем только update_diagnostic_stage_status()