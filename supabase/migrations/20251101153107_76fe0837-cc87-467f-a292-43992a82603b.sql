-- ===================================================================
-- ФИНАЛЬНАЯ МИГРАЦИЯ: СТРОГАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ СОЗДАНИЯ УЧАСТНИКОВ
-- ===================================================================

-- 1. Добавляем CHECK constraints для assignment_type
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assignment_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_assignment_type_check 
  CHECK (assignment_type IS NULL OR assignment_type IN ('self', 'manager', 'peer'));

ALTER TABLE survey_360_assignments DROP CONSTRAINT IF EXISTS survey_360_assignments_assignment_type_check;
ALTER TABLE survey_360_assignments ADD CONSTRAINT survey_360_assignments_assignment_type_check 
  CHECK (assignment_type IS NULL OR assignment_type IN ('self', 'manager', 'peer'));

-- 2. Добавляем constraint: задачи диагностики ДОЛЖНЫ иметь assignment_id и diagnostic_stage_id
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_diagnostic_must_have_ids;
ALTER TABLE tasks ADD CONSTRAINT tasks_diagnostic_must_have_ids
  CHECK (
    (task_type NOT IN ('diagnostic_stage', 'survey_360_evaluation', 'skill_survey'))
    OR 
    (task_type IN ('diagnostic_stage', 'survey_360_evaluation', 'skill_survey') 
      AND assignment_id IS NOT NULL 
      AND diagnostic_stage_id IS NOT NULL
      AND assignment_type IS NOT NULL)
  );

-- 3. Устанавливаем category по умолчанию для tasks
ALTER TABLE tasks ALTER COLUMN category SET DEFAULT 'assessment';

-- 4. Удаляем старые триггеры (если остались)
DROP TRIGGER IF EXISTS handle_diagnostic_participant_added_trigger ON diagnostic_stage_participants;
DROP TRIGGER IF EXISTS assign_surveys_to_diagnostic_participant_trigger ON diagnostic_stage_participants;
DROP TRIGGER IF EXISTS create_diagnostic_task_for_participant_trigger ON diagnostic_stage_participants;

-- 5. Создаём функцию с СТРОГОЙ последовательностью
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
  
  -- ШАГ 2: Создаём задачу для участника (самооценка)
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
  )
  ON CONFLICT DO NOTHING;
  
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
    
    -- ШАГ 4: Создаём задачу для руководителя
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
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Создаём триггер
CREATE TRIGGER handle_diagnostic_participant_added_trigger
AFTER INSERT ON diagnostic_stage_participants
FOR EACH ROW
EXECUTE FUNCTION public.handle_diagnostic_participant_added();

-- 7. Создаём функцию для проверки инвариантов (админ-функция)
CREATE OR REPLACE FUNCTION public.check_diagnostic_invariants(stage_id_param UUID)
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Проверка 1: assignment_type допустимы
  RETURN QUERY
  SELECT 
    'assignment_type_values'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END::TEXT,
    jsonb_build_object(
      'invalid_tasks', (
        SELECT jsonb_agg(jsonb_build_object('id', id, 'assignment_type', assignment_type))
        FROM tasks 
        WHERE diagnostic_stage_id = stage_id_param 
          AND assignment_type NOT IN ('self', 'manager', 'peer')
      ),
      'invalid_assignments', (
        SELECT jsonb_agg(jsonb_build_object('id', id, 'assignment_type', assignment_type))
        FROM survey_360_assignments 
        WHERE diagnostic_stage_id = stage_id_param 
          AND assignment_type NOT IN ('self', 'manager', 'peer')
      )
    )
  FROM tasks
  WHERE diagnostic_stage_id = stage_id_param 
    AND assignment_type NOT IN ('self', 'manager', 'peer');
  
  -- Проверка 2: соответствие assignment_type между tasks и assignments
  RETURN QUERY
  SELECT 
    'assignment_type_match'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END::TEXT,
    jsonb_agg(jsonb_build_object(
      'task_id', t.id,
      'task_assignment_type', t.assignment_type,
      'assignment_assignment_type', sa.assignment_type
    ))
  FROM tasks t
  JOIN survey_360_assignments sa ON t.assignment_id = sa.id
  WHERE t.diagnostic_stage_id = stage_id_param
    AND t.assignment_type != sa.assignment_type;
  
  -- Проверка 3: NULL значения в обязательных полях
  RETURN QUERY
  SELECT 
    'required_fields'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END::TEXT,
    jsonb_agg(jsonb_build_object(
      'task_id', id,
      'missing', CASE 
        WHEN assignment_id IS NULL THEN 'assignment_id'
        WHEN diagnostic_stage_id IS NULL THEN 'diagnostic_stage_id'
        WHEN assignment_type IS NULL THEN 'assignment_type'
      END
    ))
  FROM tasks
  WHERE diagnostic_stage_id = stage_id_param
    AND (assignment_id IS NULL OR diagnostic_stage_id IS NULL OR assignment_type IS NULL);
  
  -- Проверка 4: category = 'assessment'
  RETURN QUERY
  SELECT 
    'category_check'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END::TEXT,
    jsonb_agg(jsonb_build_object('task_id', id, 'category', category))
  FROM tasks
  WHERE diagnostic_stage_id = stage_id_param
    AND category != 'assessment';
END;
$$;