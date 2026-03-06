-- Исправляем функцию handle_diagnostic_participant_added
-- Проблема: пытаемся получить deadline_date из diagnostic_stages, а он находится в parent_stages

DROP FUNCTION IF EXISTS handle_diagnostic_participant_added() CASCADE;

CREATE OR REPLACE FUNCTION handle_diagnostic_participant_added()
RETURNS TRIGGER AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
  stage_deadline DATE;
  existing_task_count INT;
BEGIN
  -- Получаем руководителя и deadline из parent_stages через parent_id
  SELECT u.manager_id, ps.deadline_date
  INTO manager_user_id, stage_deadline
  FROM users u
  CROSS JOIN diagnostic_stages ds
  LEFT JOIN parent_stages ps ON ps.id = ds.parent_id
  WHERE u.id = NEW.user_id AND ds.id = NEW.stage_id;
  
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
  INTO participant_full_name
  FROM users WHERE id = NEW.user_id;
  
  -- Создаём самооценку
  INSERT INTO survey_360_assignments (
    evaluated_user_id, evaluating_user_id, diagnostic_stage_id,
    assignment_type, status, approved_at, approved_by
  ) VALUES (
    NEW.user_id, NEW.user_id, NEW.stage_id,
    'self', 'approved', now(), COALESCE(manager_user_id, NEW.user_id)
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) 
  DO UPDATE SET 
    diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
    assignment_type = EXCLUDED.assignment_type,
    status = 'approved'
  RETURNING id INTO self_assignment_id;
  
  -- Проверяем существование задачи для самооценки
  SELECT COUNT(*) INTO existing_task_count
  FROM tasks
  WHERE assignment_id = self_assignment_id
    AND user_id = NEW.user_id
    AND diagnostic_stage_id = NEW.stage_id;
  
  IF existing_task_count = 0 THEN
    INSERT INTO tasks (
      user_id, diagnostic_stage_id, assignment_id, assignment_type,
      title, description, status, deadline, task_type, category
    ) VALUES (
      NEW.user_id, NEW.stage_id, self_assignment_id, 'self',
      'Пройти самооценку',
      'Необходимо пройти комплексную оценку компетенций (самооценка + выбор коллег). Срок: ' || COALESCE(stage_deadline::text, 'не указан'),
      'pending', stage_deadline, 'diagnostic_stage', 'assessment'
    );
  END IF;
  
  -- Создаём задачу для руководителя, если он есть
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO survey_360_assignments (
      evaluated_user_id, evaluating_user_id, diagnostic_stage_id,
      assignment_type, status, is_manager_participant, approved_at, approved_by
    ) VALUES (
      NEW.user_id, manager_user_id, NEW.stage_id,
      'manager', 'approved', true, now(), manager_user_id
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) 
    DO UPDATE SET 
      diagnostic_stage_id = EXCLUDED.diagnostic_stage_id,
      assignment_type = EXCLUDED.assignment_type,
      status = 'approved'
    RETURNING id INTO manager_assignment_id;
    
    SELECT COUNT(*) INTO existing_task_count
    FROM tasks
    WHERE assignment_id = manager_assignment_id
      AND user_id = manager_user_id
      AND diagnostic_stage_id = NEW.stage_id;
    
    IF existing_task_count = 0 THEN
      INSERT INTO tasks (
        user_id, diagnostic_stage_id, assignment_id, assignment_type,
        title, description, status, deadline, task_type, category
      ) VALUES (
        manager_user_id, NEW.stage_id, manager_assignment_id, 'manager',
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || COALESCE(stage_deadline::text, 'не указан'),
        'pending', stage_deadline, 'survey_360_evaluation', 'assessment'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Пересоздаём триггер
DROP TRIGGER IF EXISTS trigger_handle_diagnostic_participant_added ON diagnostic_stage_participants;

CREATE TRIGGER trigger_handle_diagnostic_participant_added
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION handle_diagnostic_participant_added();