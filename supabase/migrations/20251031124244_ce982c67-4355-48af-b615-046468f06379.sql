-- Добавляем поле diagnostic_stage_id в таблицу survey_360_assignments
ALTER TABLE public.survey_360_assignments 
ADD COLUMN diagnostic_stage_id uuid REFERENCES public.diagnostic_stages(id) ON DELETE CASCADE;

-- Создаем индекс для улучшения производительности
CREATE INDEX idx_survey_360_assignments_diagnostic_stage 
ON public.survey_360_assignments(diagnostic_stage_id);

-- Обновляем триггер create_task_on_assignment_approval для проверки наличия пользователя
CREATE OR REPLACE FUNCTION public.create_task_on_assignment_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Only create task if status changed to 'approved' and evaluating_user is not the evaluated_user (not self-assessment)
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.evaluating_user_id != NEW.evaluated_user_id THEN
    -- Get the name of the evaluated user
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    -- Only create task if user exists
    IF evaluated_user_name IS NOT NULL THEN
      -- Create task for evaluating user
      INSERT INTO tasks (
        user_id,
        assignment_id,
        title,
        description,
        status,
        task_type,
        category
      ) VALUES (
        NEW.evaluating_user_id,
        NEW.id,
        'Оценка 360',
        'Необходимо пройти оценку 360 для ' || evaluated_user_name,
        'pending',
        'assessment',
        'Оценка 360'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;