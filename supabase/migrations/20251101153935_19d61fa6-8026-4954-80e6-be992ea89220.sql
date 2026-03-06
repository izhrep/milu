-- Исправляем триггер create_task_on_assignment_approval
-- Теперь берём assignment_type из survey_360_assignments, а не хардкодим 'survey_360'

CREATE OR REPLACE FUNCTION public.create_task_on_assignment_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  evaluated_user_name TEXT;
  task_title TEXT;
  task_description TEXT;
BEGIN
  -- НЕ создаём задачи для assignments в контексте diagnostic stage
  -- (задачи создаются через триггер handle_diagnostic_participant_added)
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
      
      -- Проверяем, нет ли уже задачи для этого assignment
      IF NOT EXISTS (
        SELECT 1 FROM tasks 
        WHERE assignment_id = NEW.id 
          AND user_id = NEW.evaluating_user_id
      ) THEN
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
          'assessment',
          NEW.assignment_type  -- ✅ ИСПРАВЛЕНО: берём из assignment, а не хардкодим
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;