-- Исправляем функцию с установкой search_path для безопасности
CREATE OR REPLACE FUNCTION public.validate_task_diagnostic_stage_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Блокируем создание задач типа diagnostic_stage и survey_360_evaluation без diagnostic_stage_id
  IF NEW.task_type IN ('diagnostic_stage', 'survey_360_evaluation', 'skill_survey') 
     AND NEW.diagnostic_stage_id IS NULL THEN
    RAISE NOTICE 'diagnostic_stage_id is null — задача типа % не создаётся', NEW.task_type;
    RETURN NULL; -- Блокируем вставку
  END IF;
  
  RETURN NEW;
END;
$function$;