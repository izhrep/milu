-- Сначала удаляем все триггеры, которые зависят от функций
DROP TRIGGER IF EXISTS create_task_on_assignment ON public.survey_360_assignments;
DROP TRIGGER IF EXISTS create_task_on_360_assignment ON public.survey_360_assignments;
DROP TRIGGER IF EXISTS create_task_for_assignment_trigger ON public.survey_360_assignments;

DROP TRIGGER IF EXISTS create_task_for_skill_assignment_trigger ON public.skill_survey_assignments;
DROP TRIGGER IF EXISTS create_task_on_skill_assignment ON public.skill_survey_assignments;

-- Теперь удаляем функции
DROP FUNCTION IF EXISTS public.create_task_for_assignment() CASCADE;
DROP FUNCTION IF EXISTS public.create_task_for_skill_assignment() CASCADE;

-- Создаем улучшенную функцию для survey_360_assignments
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
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') AND NEW.evaluating_user_id != NEW.evaluated_user_id THEN
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
        category,
        assignment_type
      ) VALUES (
        NEW.evaluating_user_id,
        NEW.id,
        'Оценка 360',
        'Необходимо пройти оценку 360 для ' || evaluated_user_name,
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

-- Создаем функцию для skill_survey_assignments
CREATE OR REPLACE FUNCTION public.create_task_on_skill_assignment_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Only create task if status changed to 'approved' and evaluating_user is not the evaluated_user (not self-assessment)
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') AND NEW.evaluating_user_id != NEW.evaluated_user_id THEN
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
        category,
        assignment_type
      ) VALUES (
        NEW.evaluating_user_id,
        NEW.id,
        'Опросник профессиональных навыков',
        'Необходимо пройти опрос профессиональных навыков для ' || evaluated_user_name,
        'pending',
        'assessment',
        'Опросник навыков',
        'skill_survey'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Создаем триггеры для обеих таблиц
DROP TRIGGER IF EXISTS create_task_on_assignment_approval_trigger ON public.survey_360_assignments;
CREATE TRIGGER create_task_on_assignment_approval_trigger
  AFTER INSERT OR UPDATE ON public.survey_360_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_task_on_assignment_approval();

DROP TRIGGER IF EXISTS create_task_on_skill_assignment_approval_trigger ON public.skill_survey_assignments;
CREATE TRIGGER create_task_on_skill_assignment_approval_trigger
  AFTER INSERT OR UPDATE ON public.skill_survey_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_task_on_skill_assignment_approval();