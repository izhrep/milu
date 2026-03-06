-- ============================================================================
-- 1. УНИФИКАЦИЯ СТРУКТУРЫ ТАБЛИЦ РЕЗУЛЬТАТОВ
-- ============================================================================

-- 1.1. Переименование user_id → evaluated_user_id в hard_skill_results
ALTER TABLE public.hard_skill_results 
  RENAME COLUMN user_id TO evaluated_user_id;

-- 1.2. Добавление новых полей в hard_skill_results
ALTER TABLE public.hard_skill_results
  ADD COLUMN IF NOT EXISTS diagnostic_stage_id uuid REFERENCES public.diagnostic_stages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.survey_360_assignments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT true;

-- 1.3. Добавление новых полей в soft_skill_results
ALTER TABLE public.soft_skill_results
  ADD COLUMN IF NOT EXISTS diagnostic_stage_id uuid REFERENCES public.diagnostic_stages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.survey_360_assignments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT true;

-- 1.4. Создание индексов для hard_skill_results
CREATE INDEX IF NOT EXISTS idx_hard_skill_results_evaluated_user ON public.hard_skill_results(evaluated_user_id);
CREATE INDEX IF NOT EXISTS idx_hard_skill_results_diagnostic_stage ON public.hard_skill_results(diagnostic_stage_id);
CREATE INDEX IF NOT EXISTS idx_hard_skill_results_assignment ON public.hard_skill_results(assignment_id);

-- 1.5. Создание индексов для soft_skill_results
CREATE INDEX IF NOT EXISTS idx_soft_skill_results_evaluated_user ON public.soft_skill_results(evaluated_user_id);
CREATE INDEX IF NOT EXISTS idx_soft_skill_results_diagnostic_stage ON public.soft_skill_results(diagnostic_stage_id);
CREATE INDEX IF NOT EXISTS idx_soft_skill_results_assignment ON public.soft_skill_results(assignment_id);

-- ============================================================================
-- 2. НОРМАЛИЗАЦИЯ ШКАЛ ОТВЕТОВ
-- ============================================================================

-- 2.1. Переименование step → numeric_value в hard_skill_answer_options
ALTER TABLE public.hard_skill_answer_options 
  RENAME COLUMN step TO numeric_value;

-- 2.2. Переименование value → numeric_value в soft_skill_answer_options
ALTER TABLE public.soft_skill_answer_options 
  RENAME COLUMN value TO numeric_value;

-- ============================================================================
-- 3. ОБНОВЛЕНИЕ ФУНКЦИЙ АГРЕГАЦИИ
-- ============================================================================

-- 3.1. Функция агрегации для hard_skill_results
CREATE OR REPLACE FUNCTION public.aggregate_hard_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Получаем diagnostic_stage_id
  stage_id := NEW.diagnostic_stage_id;
  
  -- Получаем manager_id
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.evaluated_user_id;
  
  -- Удаляем существующие агрегированные результаты для этого этапа
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id
    AND skill_id IS NOT NULL;
  
  -- Агрегируем результаты по навыкам
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    skill_id,
    self_assessment,
    manager_assessment,
    peers_average,
    total_responses
  )
  SELECT 
    NEW.evaluated_user_id,
    stage_id,
    get_evaluation_period(NOW()),
    NOW(),
    hq.skill_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    -- Peers average
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value 
      ELSE NULL 
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
$function$;

-- 3.2. Функция агрегации для soft_skill_results
CREATE OR REPLACE FUNCTION public.aggregate_soft_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Получаем diagnostic_stage_id
  stage_id := NEW.diagnostic_stage_id;
  
  -- Получаем manager_id
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.evaluated_user_id;
  
  -- Удаляем существующие агрегированные результаты для этого этапа
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id
    AND quality_id IS NOT NULL;
  
  -- Агрегируем результаты по качествам
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    quality_id,
    self_assessment,
    manager_assessment,
    peers_average,
    total_responses
  )
  SELECT 
    NEW.evaluated_user_id,
    stage_id,
    get_evaluation_period(NOW()),
    NOW(),
    sq.quality_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    -- Peers average
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value 
      ELSE NULL 
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
$function$;

-- ============================================================================
-- 4. ОБНОВЛЕНИЕ ФУНКЦИЙ ДЛЯ USER_SKILLS И USER_QUALITIES
-- ============================================================================

-- 4.1. Обновление user_skills из hard_skill_results
CREATE OR REPLACE FUNCTION public.update_user_skills_from_survey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Обновляем только при is_draft = false
  IF NEW.is_draft = false THEN
    INSERT INTO user_skills (user_id, skill_id, current_level, target_level, last_assessed_at)
    SELECT 
      NEW.evaluated_user_id,
      hq.skill_id,
      ao.numeric_value,
      ao.numeric_value + 1,
      NEW.created_at
    FROM hard_skill_questions hq
    JOIN hard_skill_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE hq.id = NEW.question_id 
      AND hq.skill_id IS NOT NULL
    ON CONFLICT (user_id, skill_id) 
    DO UPDATE SET 
      current_level = (
        SELECT AVG(ao.numeric_value)
        FROM hard_skill_results sr
        JOIN hard_skill_answer_options ao ON ao.id = sr.answer_option_id
        JOIN hard_skill_questions hq ON hq.id = sr.question_id
        WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
          AND hq.skill_id = user_skills.skill_id
          AND sr.is_draft = false
      ),
      last_assessed_at = NEW.created_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4.2. Обновление user_qualities из soft_skill_results
CREATE OR REPLACE FUNCTION public.update_user_qualities_from_survey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Обновляем только при is_draft = false
  IF NEW.is_draft = false THEN
    INSERT INTO user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at)
    SELECT 
      NEW.evaluated_user_id,
      sq.quality_id,
      ao.numeric_value,
      ao.numeric_value + 1,
      NEW.created_at
    FROM soft_skill_questions sq
    JOIN soft_skill_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE sq.id = NEW.question_id 
      AND sq.quality_id IS NOT NULL
    ON CONFLICT (user_id, quality_id) 
    DO UPDATE SET 
      current_level = (
        SELECT AVG(ao.numeric_value)
        FROM soft_skill_results sr
        JOIN soft_skill_answer_options ao ON ao.id = sr.answer_option_id
        JOIN soft_skill_questions sq ON sq.id = sr.question_id
        WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
          AND sq.quality_id = user_qualities.quality_id
          AND sr.is_draft = false
      ),
      last_assessed_at = NEW.created_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 5. ОБНОВЛЕНИЕ ТРИГГЕРА НАЗНАЧЕНИЙ
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  manager_user_id uuid;
BEGIN
  -- Получаем руководителя пользователя
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.user_id;
  
  -- Создаем самооценку
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
    NEW.user_id
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- Создаем оценку руководителя (если есть)
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
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
      NEW.user_id
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 6. СИНХРОНИЗАЦИЯ СТАТУСОВ ЗАДАЧ И НАЗНАЧЕНИЙ
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_task_status_on_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Если статус assignment стал 'completed', обновляем все связанные задачи
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE tasks
    SET status = 'completed',
        updated_at = now()
    WHERE assignment_id = NEW.id
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Создаем триггер
DROP TRIGGER IF EXISTS trigger_update_task_status ON survey_360_assignments;
CREATE TRIGGER trigger_update_task_status
  AFTER UPDATE ON survey_360_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_task_status_on_assignment_change();

-- ============================================================================
-- 7. ОБНОВЛЕНИЕ RLS ПОЛИТИК
-- ============================================================================

-- 7.1. Удаляем старые политики для hard_skill_results
DROP POLICY IF EXISTS "Users can view their skill survey results" ON hard_skill_results;
DROP POLICY IF EXISTS "Users can insert their skill survey results" ON hard_skill_results;
DROP POLICY IF EXISTS "Managers can view subordinate skill results" ON hard_skill_results;

-- 7.2. Создаем новые политики для hard_skill_results
CREATE POLICY "Users can view hard_skill_results"
  ON hard_skill_results FOR SELECT
  USING (
    evaluating_user_id = get_current_session_user() 
    OR evaluated_user_id = get_current_session_user()
    OR is_current_user_admin()
    OR is_manager_of_user(evaluated_user_id)
  );

CREATE POLICY "Users can insert hard_skill_results"
  ON hard_skill_results FOR INSERT
  WITH CHECK (
    evaluating_user_id = get_current_session_user() 
    OR is_current_user_admin()
  );

CREATE POLICY "Users can update hard_skill_results"
  ON hard_skill_results FOR UPDATE
  USING (
    evaluating_user_id = get_current_session_user() 
    OR is_current_user_admin()
  );

CREATE POLICY "Users can delete hard_skill_results"
  ON hard_skill_results FOR DELETE
  USING (
    evaluating_user_id = get_current_session_user() 
    OR is_current_user_admin()
  );

-- 7.3. Удаляем старые политики для soft_skill_results
DROP POLICY IF EXISTS "Users can view their 360 results" ON soft_skill_results;
DROP POLICY IF EXISTS "Users can insert their 360 results" ON soft_skill_results;
DROP POLICY IF EXISTS "Users can delete their 360 results" ON soft_skill_results;
DROP POLICY IF EXISTS "Managers can view subordinate 360 results" ON soft_skill_results;

-- 7.4. Создаем новые политики для soft_skill_results
CREATE POLICY "Users can view soft_skill_results"
  ON soft_skill_results FOR SELECT
  USING (
    evaluating_user_id = get_current_session_user() 
    OR evaluated_user_id = get_current_session_user()
    OR is_current_user_admin()
    OR is_manager_of_user(evaluated_user_id)
  );

CREATE POLICY "Users can insert soft_skill_results"
  ON soft_skill_results FOR INSERT
  WITH CHECK (
    evaluating_user_id = get_current_session_user() 
    OR is_current_user_admin()
  );

CREATE POLICY "Users can update soft_skill_results"
  ON soft_skill_results FOR UPDATE
  USING (
    evaluating_user_id = get_current_session_user() 
    OR is_current_user_admin()
  );

CREATE POLICY "Users can delete soft_skill_results"
  ON soft_skill_results FOR DELETE
  USING (
    evaluating_user_id = get_current_session_user() 
    OR is_current_user_admin()
  );

-- ============================================================================
-- 8. ПЕРЕСОЗДАНИЕ ТРИГГЕРОВ АГРЕГАЦИИ
-- ============================================================================

-- Удаляем старые триггеры
DROP TRIGGER IF EXISTS aggregate_hard_skill_results_trigger ON hard_skill_results;
DROP TRIGGER IF EXISTS aggregate_soft_skill_results_trigger ON soft_skill_results;

-- Создаем новые триггеры
CREATE TRIGGER aggregate_hard_skill_results_trigger
  AFTER INSERT OR UPDATE ON hard_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION aggregate_hard_skill_results();

CREATE TRIGGER aggregate_soft_skill_results_trigger
  AFTER INSERT OR UPDATE ON soft_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION aggregate_soft_skill_results();