-- Создаём функцию-триггер для проверки diagnostic_stage_id перед созданием задачи
CREATE OR REPLACE FUNCTION public.validate_task_diagnostic_stage_id()
RETURNS trigger
LANGUAGE plpgsql
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

-- Создаём BEFORE INSERT триггер на таблице tasks
DROP TRIGGER IF EXISTS validate_task_diagnostic_stage_id_trigger ON public.tasks;

CREATE TRIGGER validate_task_diagnostic_stage_id_trigger
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.validate_task_diagnostic_stage_id();