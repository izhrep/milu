-- Исправление функции назначения опросов участникам диагностики
-- Убираем проверку evaluation_period и устанавливаем его автоматически

CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_record RECORD;
  eval_period text;
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
  
  -- Создаем задание на самооценку навыков
  INSERT INTO skill_survey_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'отправлен запрос'
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- Создаем задание на оценку 360 от руководителя
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  )
  SELECT 
    NEW.user_id,
    u.manager_id,
    'отправлен запрос'
  FROM users u
  WHERE u.id = NEW.user_id 
    AND u.manager_id IS NOT NULL
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

-- Удаляем старый триггер если существует
DROP TRIGGER IF EXISTS trigger_assign_surveys_to_diagnostic_participant ON diagnostic_stage_participants;

-- Создаем триггер для автоматического назначения опросов при добавлении участника
CREATE TRIGGER trigger_assign_surveys_to_diagnostic_participant
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION assign_surveys_to_diagnostic_participant();