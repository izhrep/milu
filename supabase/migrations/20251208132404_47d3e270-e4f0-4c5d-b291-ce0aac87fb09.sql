-- Update existing peer_selection tasks description
UPDATE public.tasks 
SET description = 'Выберите респондентов для прохождения формы "Обратная связь 360"'
WHERE task_type = 'peer_selection' 
AND description LIKE '%Выберите коллег для проведения оценки 360%';

-- Update existing self-assessment tasks title  
UPDATE public.tasks
SET title = 'Начать опрос "Обратная связь 360" по себе'
WHERE task_type = 'diagnostic_stage'
AND assignment_type = 'self'
AND title = 'Пройти самооценку';

-- Update the trigger function for new tasks
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  stage_deadline_date DATE;
  self_assignment_id UUID;
BEGIN
  -- Get deadline from parent_stages
  SELECT ps.deadline_date INTO stage_deadline_date
  FROM diagnostic_stages ds
  JOIN parent_stages ps ON ds.parent_id = ps.id
  WHERE ds.id = NEW.stage_id;

  -- Create self assignment
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    diagnostic_stage_id,
    assignment_type,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.stage_id,
    'self',
    'pending'
  )
  RETURNING id INTO self_assignment_id;

  -- Create self-assessment task with new title
  INSERT INTO tasks (
    user_id,
    diagnostic_stage_id,
    assignment_id,
    assignment_type,
    title,
    description,
    status,
    deadline,
    category,
    task_type
  ) VALUES (
    NEW.user_id,
    NEW.stage_id,
    self_assignment_id,
    'self',
    'Начать опрос "Обратная связь 360" по себе',
    'Необходимо пройти опрос "Обратная связь 360" по себе. Срок: ' || COALESCE(stage_deadline_date::text, 'не указан'),
    'pending',
    stage_deadline_date,
    'diagnostic_stage',
    'diagnostic_stage'
  );

  -- Create peer_selection task with new description
  INSERT INTO tasks (
    user_id,
    diagnostic_stage_id,
    title,
    description,
    status,
    deadline,
    task_type,
    priority,
    category
  ) VALUES (
    NEW.user_id,
    NEW.stage_id,
    'Выбрать респондентов',
    'Выберите респондентов для прохождения формы "Обратная связь 360"',
    'pending',
    stage_deadline_date,
    'peer_selection',
    'urgent',
    'assessment'
  );

  RETURN NEW;
END;
$function$;