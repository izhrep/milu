-- =========================================================
-- Выравнивание статусов: БД использует 'completed', UI - 'Выполнено'
-- =========================================================

-- 1. Исправляем триггер update_task_status_on_assignment_change
CREATE OR REPLACE FUNCTION public.update_task_status_on_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Если статус assignment стал 'completed', обновляем все связанные задачи
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE tasks
    SET status = 'completed',
        updated_at = now()
    WHERE assignment_id = NEW.id
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Исправляем триггер update_assignment_on_survey_completion
CREATE OR REPLACE FUNCTION public.update_assignment_on_survey_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update assignment status to completed
  UPDATE public.survey_360_assignments
  SET status = 'completed',
      updated_at = now()
  WHERE evaluated_user_id = NEW.evaluated_user_id 
    AND evaluating_user_id = NEW.evaluating_user_id;
  
  -- Update corresponding task status
  UPDATE public.tasks
  SET status = 'completed',
      updated_at = now()
  FROM public.survey_360_assignments sa
  WHERE tasks.assignment_id = sa.id
    AND sa.evaluated_user_id = NEW.evaluated_user_id
    AND sa.evaluating_user_id = NEW.evaluating_user_id;
  
  RETURN NEW;
END;
$function$;

-- 3. Обновляем существующие записи с 'выполнено' на 'completed'
UPDATE public.survey_360_assignments
SET status = 'completed'
WHERE status = 'выполнено';

UPDATE public.tasks
SET status = 'completed'
WHERE status = 'выполнено';

-- 4. Комментарий для документации
COMMENT ON FUNCTION public.update_task_status_on_assignment_change IS 
'Обновляет статус задач при изменении статуса назначения. Использует completed в БД.';

COMMENT ON FUNCTION public.update_assignment_on_survey_completion IS 
'Обновляет статус назначения при завершении опроса. Использует completed в БД.';