
-- ============================================
-- FIX BUG 3: Create missing tasks for self and manager assignments
-- Also update the trigger to properly create tasks
-- ============================================

-- Create self-assessment task for Yurasova if not exists
INSERT INTO tasks (
  user_id,
  diagnostic_stage_id,
  assignment_id,
  assignment_type,
  title,
  description,
  status,
  task_type,
  category
) 
SELECT 
  '7c04b872-6de2-418d-b959-616894d398d7',
  '2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36',
  'fb6846f5-54df-4e1a-a4f6-435a9848f454',
  'self',
  'Пройти самооценку',
  'Необходимо пройти комплексную оценку компетенций (самооценка)',
  'expired',  -- Stage has ended, so mark as expired
  'diagnostic_stage',
  'assessment'
WHERE NOT EXISTS (
  SELECT 1 FROM tasks 
  WHERE assignment_id = 'fb6846f5-54df-4e1a-a4f6-435a9848f454'
);

-- Create manager evaluation task for Yurasova if not exists
INSERT INTO tasks (
  user_id,
  diagnostic_stage_id,
  assignment_id,
  assignment_type,
  title,
  description,
  status,
  task_type,
  category
) 
SELECT 
  '4cf40061-4c6f-4379-8082-5bb2ddd8a5ef',
  '2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36',
  '0b17db1b-93c5-4dc4-919f-2b91a9de73da',
  'manager',
  'Оценка подчинённого: Юрасова',
  'Необходимо пройти оценку 360 для Юрасова',
  'expired',  -- Stage has ended, so mark as expired
  'survey_360_evaluation',
  'assessment'
WHERE NOT EXISTS (
  SELECT 1 FROM tasks 
  WHERE assignment_id = '0b17db1b-93c5-4dc4-919f-2b91a9de73da'
);

-- Update self/manager assignments to expired since stage has ended
UPDATE survey_360_assignments
SET status = 'expired', status_at_stage_end = 'approved'
WHERE id IN ('fb6846f5-54df-4e1a-a4f6-435a9848f454', '0b17db1b-93c5-4dc4-919f-2b91a9de73da')
  AND status = 'approved';

-- ============================================
-- Update the trigger function to properly create tasks for self/manager
-- The current function uses ON CONFLICT DO NOTHING which silently fails
-- We need to ensure tasks are created even when assignment already exists
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_diagnostic_participant_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
  stage_deadline DATE;
  stage_reminder DATE;
  existing_task_count INT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
BEGIN
  -- Получаем руководителя и даты из parent_stages через parent_id
  SELECT u.manager_id, ps.end_date, ps.reminder_date
  INTO manager_user_id, stage_deadline, stage_reminder
  FROM users u
  CROSS JOIN diagnostic_stages ds
  LEFT JOIN parent_stages ps ON ps.id = ds.parent_id
  WHERE u.id = NEW.user_id AND ds.id = NEW.stage_id;

  -- Получаем ФИО участника
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
  INTO participant_full_name
  FROM users WHERE id = NEW.user_id;

  -- Проверяем, есть ли уже задача на выбор респондентов для этого пользователя в этом этапе
  SELECT COUNT(*) INTO existing_task_count
  FROM tasks
  WHERE user_id = NEW.user_id
    AND diagnostic_stage_id = NEW.stage_id
    AND task_type = 'peer_selection';

  -- Создаём SELF assignment для сотрудника (самооценка)
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
    'approved'
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id, diagnostic_stage_id) DO NOTHING
  RETURNING id INTO self_assignment_id;

  -- Если assignment уже существовал, получаем его id
  IF self_assignment_id IS NULL THEN
    SELECT id INTO self_assignment_id
    FROM survey_360_assignments
    WHERE evaluated_user_id = NEW.user_id
      AND evaluating_user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id;
  END IF;

  -- Создаём задачу на выбор респондентов (если ещё нет)
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
      'Выбрать оценивающих',
      'Выберите коллег для проведения оценки 360. Напоминание: ' || COALESCE(stage_reminder::text, 'не указано') || '. Срок: ' || COALESCE(stage_deadline::text, 'не указан'),
      'pending',
      stage_deadline,
      'peer_selection',
      'assessment'
    );
  END IF;

  -- Создаём задачу на самооценку для сотрудника (если ещё нет)
  SELECT COUNT(*) INTO existing_task_count
  FROM tasks
  WHERE assignment_id = self_assignment_id
    AND user_id = NEW.user_id
    AND diagnostic_stage_id = NEW.stage_id
    AND task_type = 'diagnostic_stage';

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
      'Необходимо пройти комплексную оценку компетенций (самооценка). Срок: ' || COALESCE(stage_deadline::text, 'не указан'),
      'pending',
      stage_deadline,
      'diagnostic_stage',
      'assessment'
    );
  END IF;

  -- Если есть руководитель, создаём manager assignment и задачу
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      assignment_type,
      is_manager_participant,
      status
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      NEW.stage_id,
      'manager',
      true,
      'approved'
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id, diagnostic_stage_id) DO NOTHING
    RETURNING id INTO manager_assignment_id;

    -- Если assignment уже существовал, получаем его id
    IF manager_assignment_id IS NULL THEN
      SELECT id INTO manager_assignment_id
      FROM survey_360_assignments
      WHERE evaluated_user_id = NEW.user_id
        AND evaluating_user_id = manager_user_id
        AND diagnostic_stage_id = NEW.stage_id;
    END IF;

    -- Создаём задачу для руководителя (если ещё нет)
    SELECT COUNT(*) INTO existing_task_count
    FROM tasks
    WHERE assignment_id = manager_assignment_id
      AND user_id = manager_user_id
      AND diagnostic_stage_id = NEW.stage_id;

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
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || COALESCE(stage_deadline::text, 'не указан'),
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
