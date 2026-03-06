-- ========================================
-- ПОЛНОЕ ИСПРАВЛЕНИЕ СИСТЕМЫ ДИАГНОСТИКИ (ЧАСТЬ 2)
-- Пересоздание всех функций и триггеров
-- ========================================

-- ФУНКЦИЯ 1: обработка добавления участника диагностики (ПЕРЕПИСАНА)
CREATE OR REPLACE FUNCTION public.handle_diagnostic_participant_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
  stage_deadline DATE;
  existing_task_count INT;
BEGIN
  SELECT u.manager_id, ds.deadline_date
  INTO manager_user_id, stage_deadline
  FROM users u
  CROSS JOIN diagnostic_stages ds
  WHERE u.id = NEW.user_id AND ds.id = NEW.stage_id;
  
  SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
  INTO participant_full_name
  FROM users WHERE id = NEW.user_id;
  
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
      'Необходимо пройти комплексную оценку компетенций (самооценка + выбор коллег). Срок: ' || stage_deadline::text,
      'pending', stage_deadline, 'diagnostic_stage', 'assessment'
    );
  END IF;
  
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
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || stage_deadline::text,
        'pending', stage_deadline, 'survey_360_evaluation', 'assessment'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ФУНКЦИЯ 2: агрегация hard_skill_results (ИСПРАВЛЕНА)
CREATE OR REPLACE FUNCTION public.aggregate_hard_skill_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  stage_id := NEW.diagnostic_stage_id;
  IF stage_id IS NULL THEN RETURN NEW; END IF;
  
  SELECT u.manager_id INTO manager_id FROM users u WHERE u.id = NEW.evaluated_user_id;
  
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id AND skill_id IS NOT NULL;
  
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, skill_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, stage_id, get_evaluation_period(NOW()), NOW(), hq.skill_id,
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value ELSE NULL 
    END),
    COUNT(*)
  FROM hard_skill_results sr
  JOIN hard_skill_questions hq ON sr.question_id = hq.id
  JOIN hard_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND hq.skill_id IS NOT NULL
  GROUP BY hq.skill_id;
  
  RETURN NEW;
END;
$$;

-- ФУНКЦИЯ 3: агрегация soft_skill_results (ИСПРАВЛЕНА)
CREATE OR REPLACE FUNCTION public.aggregate_soft_skill_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  stage_id := NEW.diagnostic_stage_id;
  IF stage_id IS NULL THEN RETURN NEW; END IF;
  
  SELECT u.manager_id INTO manager_id FROM users u WHERE u.id = NEW.evaluated_user_id;
  
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id AND quality_id IS NOT NULL;
  
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, quality_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, stage_id, get_evaluation_period(NOW()), NOW(), sq.quality_id,
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value ELSE NULL 
    END),
    COUNT(*)
  FROM soft_skill_results sr
  JOIN soft_skill_questions sq ON sr.question_id = sq.id
  JOIN soft_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND sq.quality_id IS NOT NULL
  GROUP BY sq.quality_id;
  
  RETURN NEW;
END;
$$;

-- ФУНКЦИЯ 4: автообновление assignment при завершении опроса
CREATE OR REPLACE FUNCTION public.update_assignment_on_survey_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_draft = false AND NEW.assignment_id IS NOT NULL THEN
    UPDATE survey_360_assignments
    SET status = 'completed', updated_at = now()
    WHERE id = NEW.assignment_id AND status != 'completed';
  END IF;
  RETURN NEW;
END;
$$;

-- ФУНКЦИЯ 5: автообновление статуса задачи при изменении assignment
CREATE OR REPLACE FUNCTION public.update_task_status_on_assignment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE tasks
    SET status = 'completed', updated_at = now()
    WHERE assignment_id = NEW.id AND status != 'completed';
  END IF;
  RETURN NEW;
END;
$$;

-- ФУНКЦИЯ 6: создание задач при утверждении assignment
CREATE OR REPLACE FUNCTION public.create_task_on_assignment_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evaluated_user_name TEXT;
  task_title TEXT;
  task_description TEXT;
BEGIN
  IF NEW.diagnostic_stage_id IS NOT NULL THEN RETURN NEW; END IF;
  
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) INTO evaluated_user_name
    FROM users WHERE id = NEW.evaluated_user_id;
    
    IF evaluated_user_name IS NOT NULL THEN
      IF NEW.evaluating_user_id = NEW.evaluated_user_id THEN
        task_title := 'Самооценка 360';
        task_description := 'Необходимо пройти самооценку 360';
      ELSE
        task_title := 'Оценка 360: ' || evaluated_user_name;
        task_description := 'Необходимо пройти оценку 360 для ' || evaluated_user_name;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM tasks WHERE assignment_id = NEW.id AND user_id = NEW.evaluating_user_id) THEN
        INSERT INTO tasks (
          user_id, assignment_id, title, description,
          status, task_type, category, assignment_type
        ) VALUES (
          NEW.evaluating_user_id, NEW.id, task_title, task_description,
          'pending', 'assessment', 'assessment', NEW.assignment_type
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;