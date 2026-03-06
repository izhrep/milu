-- Обновляем функцию создания задач для 360 assignments
-- Теперь она НЕ создаёт задачи, если assignment связан с diagnostic_stage_id
-- (задачи создаются только через триггер create_diagnostic_task_for_participant)
CREATE OR REPLACE FUNCTION public.create_task_on_assignment_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  evaluated_user_name TEXT;
  task_title TEXT;
  task_description TEXT;
BEGIN
  -- НЕ создаём задачи для assignments в контексте diagnostic stage
  -- (задачи создаются через триггер create_diagnostic_task_for_participant)
  IF NEW.diagnostic_stage_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Только для assignments вне diagnostic stage создаём задачу
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    IF evaluated_user_name IS NOT NULL THEN
      IF NEW.evaluating_user_id = NEW.evaluated_user_id THEN
        task_title := 'Самооценка 360';
        task_description := 'Необходимо пройти самооценку 360';
      ELSE
        task_title := 'Оценка 360';
        task_description := 'Необходимо пройти оценку 360 для ' || evaluated_user_name;
      END IF;
      
      INSERT INTO tasks (
        user_id,
        assignment_id,
        title,
        description,
        status,
        task_type,
        category,
        assignment_type
      ) VALUES (
        NEW.evaluating_user_id,
        NEW.id,
        task_title,
        task_description,
        'pending',
        'assessment',
        'Оценка 360',
        'survey_360'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Обновляем функцию создания задач для skill assignments
-- Теперь она НЕ создаёт задачи вообще (задачи создаются только через триггер diagnostic)
CREATE OR REPLACE FUNCTION public.create_task_on_skill_assignment_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- НЕ создаём задачи для skill assignments
  -- Все задачи создаются через триггер create_diagnostic_task_for_participant
  RETURN NEW;
END;
$function$;