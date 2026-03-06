-- Исправляем триггер: убираем ON CONFLICT DO NOTHING из tasks
-- так как нет уникальных constraints кроме PRIMARY KEY

CREATE OR REPLACE FUNCTION public.handle_diagnostic_participant_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
  stage_deadline DATE;
  existing_task_count INT;
BEGIN
  -- Получаем руководителя участника и дедлайн этапа
  SELECT u.manager_id, ds.deadline_date
  INTO manager_user_id, stage_deadline
  FROM users u
  CROSS JOIN diagnostic_stages ds
  WHERE u.id = NEW.user_id
    AND ds.id = NEW.stage_id;
  
  -- Получаем ФИО участника
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
  INTO participant_full_name
  FROM users
  WHERE id = NEW.user_id;
  
  -- ШАГ 1: Создаём самооценку в survey_360_assignments
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    diagnostic_stage_id,
    assignment_type,
    status,
    approved_at,
    approved_by
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.stage_id,
    'self',
    'approved',
    now(),
    COALESCE(manager_user_id, NEW.user_id)
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) 
  DO UPDATE SET 
    diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
    assignment_type = EXCLUDED.assignment_type
  RETURNING id INTO self_assignment_id;
  
  -- ШАГ 2: Проверяем, есть ли уже задача для этого assignment
  SELECT COUNT(*) INTO existing_task_count
  FROM tasks
  WHERE assignment_id = self_assignment_id
    AND user_id = NEW.user_id
    AND diagnostic_stage_id = NEW.stage_id;
  
  -- Создаём задачу только если её ещё нет
  IF existing_task_count = 0 THEN
    INSERT INTO tasks (
      user_id,
      diagnostic_stage_id,
      assignment_id,
      assignment_type,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      self_assignment_id,
      'self',
      'Пройти самооценку',
      'Необходимо пройти комплексную оценку компетенций (самооценка + выбор коллег). Срок: ' || stage_deadline::text,
      'pending',
      stage_deadline,
      'diagnostic_stage',
      'assessment'
    );
  END IF;
  
  -- ШАГ 3: Если есть руководитель, создаём оценку руководителя
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    -- Создаём назначение для руководителя
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      assignment_type,
      status,
      is_manager_participant,
      approved_at,
      approved_by
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      NEW.stage_id,
      'manager',
      'approved',
      true,
      now(),
      manager_user_id
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) 
    DO UPDATE SET 
      diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
      assignment_type = EXCLUDED.assignment_type
    RETURNING id INTO manager_assignment_id;
    
    -- ШАГ 4: Проверяем, есть ли уже задача для руководителя
    SELECT COUNT(*) INTO existing_task_count
    FROM tasks
    WHERE assignment_id = manager_assignment_id
      AND user_id = manager_user_id
      AND diagnostic_stage_id = NEW.stage_id;
    
    -- Создаём задачу только если её ещё нет
    IF existing_task_count = 0 THEN
      INSERT INTO tasks (
        user_id,
        diagnostic_stage_id,
        assignment_id,
        assignment_type,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      ) VALUES (
        manager_user_id,
        NEW.stage_id,
        manager_assignment_id,
        'manager',
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || stage_deadline::text,
        'pending',
        stage_deadline,
        'survey_360_evaluation',
        'assessment'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;