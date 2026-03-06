-- Обновляем функцию для автоматического создания survey_360_assignments при добавлении участников диагностики
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
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status,
    diagnostic_stage_id,
    is_manager_participant,
    approved_at,
    approved_by
  )
  SELECT 
    NEW.user_id,
    u.manager_id,
    'approved',
    NEW.stage_id,
    true,
    now(),
    NEW.user_id
  FROM users u
  WHERE u.id = NEW.user_id 
    AND u.manager_id IS NOT NULL
    AND u.manager_id != NEW.user_id
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

-- Обновляем функцию создания задач, чтобы создавать задачи и для самооценки
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
  -- Only create task if status is 'approved' and this is a new approval
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    -- Get the name of the evaluated user
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    -- Only create task if user exists
    IF evaluated_user_name IS NOT NULL THEN
      -- Determine task title and description based on whether this is self-assessment or peer assessment
      IF NEW.evaluating_user_id = NEW.evaluated_user_id THEN
        -- Self-assessment
        task_title := 'Самооценка 360';
        task_description := 'Необходимо пройти самооценку 360';
      ELSE
        -- Peer/manager assessment
        task_title := 'Оценка 360';
        task_description := 'Необходимо пройти оценку 360 для ' || evaluated_user_name;
      END IF;
      
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

-- Обновляем функцию для создания задач при утверждении skill_survey_assignments
CREATE OR REPLACE FUNCTION public.create_task_on_skill_assignment_approval()
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
  -- Only create task if status is 'approved' and this is a new approval
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    -- Get the name of the evaluated user
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    -- Only create task if user exists
    IF evaluated_user_name IS NOT NULL THEN
      -- Determine task title and description based on whether this is self-assessment
      IF NEW.evaluating_user_id = NEW.evaluated_user_id THEN
        -- Self-assessment
        task_title := 'Самооценка навыков';
        task_description := 'Необходимо пройти самооценку профессиональных навыков';
      ELSE
        -- Peer assessment
        task_title := 'Опросник профессиональных навыков';
        task_description := 'Необходимо пройти опрос профессиональных навыков для ' || evaluated_user_name;
      END IF;
      
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
        task_title,
        task_description,
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