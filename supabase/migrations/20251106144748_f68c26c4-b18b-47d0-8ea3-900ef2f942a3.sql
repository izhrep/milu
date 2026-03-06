-- Исправление функции complete_diagnostic_task_on_surveys_completion
-- Проблема: для hard_skill_results использовалось NEW.user_id и WHERE user_id, 
-- но поле называется evaluated_user_id

CREATE OR REPLACE FUNCTION public.complete_diagnostic_task_on_surveys_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id uuid;
  has_hard_skill_survey boolean;
  has_soft_skill_survey boolean;
BEGIN
  IF TG_TABLE_NAME = 'hard_skill_results' THEN
    target_user_id := NEW.evaluated_user_id;  -- ИСПРАВЛЕНО: было NEW.user_id
  ELSIF TG_TABLE_NAME = 'soft_skill_results' THEN
    target_user_id := NEW.evaluated_user_id;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM hard_skill_results 
    WHERE evaluated_user_id = target_user_id  -- ИСПРАВЛЕНО: было user_id
    LIMIT 1
  ) INTO has_hard_skill_survey;
  
  SELECT EXISTS (
    SELECT 1 FROM soft_skill_results 
    WHERE evaluated_user_id = target_user_id
    LIMIT 1
  ) INTO has_soft_skill_survey;
  
  IF has_hard_skill_survey AND has_soft_skill_survey THEN
    UPDATE tasks
    SET status = 'completed',
        updated_at = now()
    WHERE user_id = target_user_id
      AND task_type = 'assessment'
      AND category = 'Диагностика'
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$function$;