-- Проверка и исправление функции автоматического создания назначений при добавлении участника диагностики
-- Эта функция должна создавать:
-- 1. Самооценку 360 (approved)
-- 2. Оценку от руководителя 360 (approved)
-- 3. Самооценку навыков (approved)

CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_record RECORD;
  eval_period text;
  manager_user_id uuid;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Устанавливаем evaluation_period на основе текущей даты
  eval_period := get_evaluation_period(now());
  
  -- Обновляем этап с evaluation_period если его нет
  IF stage_record.evaluation_period IS NULL THEN
    UPDATE diagnostic_stages
    SET evaluation_period = eval_period
    WHERE id = NEW.stage_id;
  ELSE
    eval_period := stage_record.evaluation_period;
  END IF;
  
  -- Получаем руководителя пользователя
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.user_id;
  
  -- 1. Создаем задание на самооценку навыков
  INSERT INTO skill_survey_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'approved'
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- 2. Создаем задание на самооценку 360 со статусом approved
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status,
    diagnostic_stage_id,
    approved_at,
    approved_by
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'approved',
    NEW.stage_id,
    now(),
    NEW.user_id
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- 3. Создаем задание на оценку 360 от руководителя (если есть) со статусом approved
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      status,
      diagnostic_stage_id,
      is_manager_participant,
      approved_at,
      approved_by
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      'approved',
      NEW.stage_id,
      true,
      now(),
      NEW.user_id
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Создаём триггер, если он не существует
DROP TRIGGER IF EXISTS on_diagnostic_participant_added ON diagnostic_stage_participants;
CREATE TRIGGER on_diagnostic_participant_added
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION assign_surveys_to_diagnostic_participant();