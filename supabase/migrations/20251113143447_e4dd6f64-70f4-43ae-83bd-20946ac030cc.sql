
-- ============================================================================
-- ФИНАЛЬНАЯ МИГРАЦИЯ: ИСПРАВЛЕНИЕ СТАТУСОВ И ОПТИМИЗАЦИЯ
-- ============================================================================
-- Дата: 13.11.2025
-- Описание: Корректировка статусов незавершённых peer assignments и создание
--           недостающих задач для коллег

-- 1. Обновляем статусы peer assignments без результатов
-- Если коллега ещё не прошёл оценку, assignment должен оставаться в статусе 'approved'
-- но нужно убедиться, что для него есть задача

DO $$
DECLARE
  peer_assignment RECORD;
  peer_task_exists BOOLEAN;
  evaluated_user_name TEXT;
BEGIN
  -- Проходим по всем peer assignments без результатов
  FOR peer_assignment IN 
    SELECT 
      sa.id,
      sa.evaluated_user_id,
      sa.evaluating_user_id,
      sa.diagnostic_stage_id
    FROM survey_360_assignments sa
    WHERE sa.assignment_type = 'peer'
      AND sa.diagnostic_stage_id IS NOT NULL
      AND sa.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM hard_skill_results 
        WHERE assignment_id = sa.id AND is_draft = false
      )
      AND NOT EXISTS (
        SELECT 1 FROM soft_skill_results 
        WHERE assignment_id = sa.id AND is_draft = false
      )
  LOOP
    -- Проверяем, есть ли задача для этого assignment
    SELECT EXISTS (
      SELECT 1 FROM tasks 
      WHERE assignment_id = peer_assignment.id
    ) INTO peer_task_exists;
    
    -- Если задачи нет, создаём её
    IF NOT peer_task_exists THEN
      -- Получаем имя оцениваемого пользователя
      SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
      INTO evaluated_user_name
      FROM users
      WHERE id = peer_assignment.evaluated_user_id;
      
      -- Создаём задачу для коллеги
      INSERT INTO tasks (
        user_id,
        assignment_id,
        diagnostic_stage_id,
        assignment_type,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      )
      SELECT
        peer_assignment.evaluating_user_id,
        peer_assignment.id,
        peer_assignment.diagnostic_stage_id,
        'peer',
        'Оценка коллеги: ' || evaluated_user_name,
        'Необходимо пройти оценку 360 для коллеги ' || evaluated_user_name || '. Срок: ' || ds.deadline_date::text,
        'pending',
        ds.deadline_date,
        'survey_360_evaluation',
        'assessment'
      FROM diagnostic_stages ds
      WHERE ds.id = peer_assignment.diagnostic_stage_id;
      
      RAISE NOTICE 'Создана задача для peer assignment %', peer_assignment.id;
    END IF;
  END LOOP;
END $$;

-- 2. Добавляем индексы для оптимизации производительности
-- Эти индексы ускорят поиск результатов и assignments по этапам диагностики

CREATE INDEX IF NOT EXISTS idx_hard_skill_results_diagnostic_stage 
  ON hard_skill_results(diagnostic_stage_id, evaluated_user_id)
  WHERE diagnostic_stage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_soft_skill_results_diagnostic_stage 
  ON soft_skill_results(diagnostic_stage_id, evaluated_user_id)
  WHERE diagnostic_stage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_survey_360_assignments_diagnostic_stage 
  ON survey_360_assignments(diagnostic_stage_id, evaluated_user_id)
  WHERE diagnostic_stage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_diagnostic_stage 
  ON tasks(diagnostic_stage_id, user_id, status)
  WHERE diagnostic_stage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_assessment_results_diagnostic_stage 
  ON user_assessment_results(diagnostic_stage_id, user_id)
  WHERE diagnostic_stage_id IS NOT NULL;

-- 3. Добавляем недостающий search_path к функциям без него
-- Это исправит предупреждение "Function Search Path Mutable" из Supabase Linter

-- Функция для проверки существования задачи на основе assignment
DROP FUNCTION IF EXISTS public.validate_task_diagnostic_stage_id() CASCADE;

CREATE OR REPLACE FUNCTION public.validate_task_diagnostic_stage_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Блокируем создание задач типа diagnostic_stage и survey_360_evaluation без diagnostic_stage_id
  IF NEW.task_type IN ('diagnostic_stage', 'survey_360_evaluation', 'skill_survey') 
     AND NEW.diagnostic_stage_id IS NULL THEN
    RAISE NOTICE 'diagnostic_stage_id is null — задача типа % не создаётся', NEW.task_type;
    RETURN NULL; -- Блокируем вставку
  END IF;
  
  RETURN NEW;
END;
$$;

-- Пересоздаём триггер с обновлённой функцией
DROP TRIGGER IF EXISTS validate_task_diagnostic_stage_id_trigger ON tasks;
CREATE TRIGGER validate_task_diagnostic_stage_id_trigger
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_task_diagnostic_stage_id();

-- 4. Обновляем функцию update_updated_at_column с search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 5. Обновляем функцию set_evaluation_period с search_path
CREATE OR REPLACE FUNCTION public.set_evaluation_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.evaluation_period = get_evaluation_period(NEW.created_at);
  RETURN NEW;
END;
$$;

-- 6. Создаём функцию для проверки консистентности данных диагностики
CREATE OR REPLACE FUNCTION public.check_diagnostic_data_consistency()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Проверка 1: Assignments без задач
  RETURN QUERY
  SELECT 
    'assignments_without_tasks'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'assignments', (
        SELECT jsonb_agg(jsonb_build_object(
          'id', sa.id,
          'type', sa.assignment_type,
          'evaluated_user', sa.evaluated_user_id,
          'evaluating_user', sa.evaluating_user_id
        ))
        FROM survey_360_assignments sa
        WHERE sa.diagnostic_stage_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM tasks WHERE assignment_id = sa.id)
      )
    )
  FROM survey_360_assignments sa
  WHERE sa.diagnostic_stage_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM tasks WHERE assignment_id = sa.id);
  
  -- Проверка 2: Задачи без assignments
  RETURN QUERY
  SELECT 
    'tasks_without_assignments'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'tasks', (
        SELECT jsonb_agg(jsonb_build_object(
          'id', t.id,
          'type', t.task_type,
          'assignment_id', t.assignment_id
        ))
        FROM tasks t
        WHERE t.task_type IN ('diagnostic_stage', 'survey_360_evaluation')
          AND t.assignment_id IS NULL
      )
    )
  FROM tasks t
  WHERE t.task_type IN ('diagnostic_stage', 'survey_360_evaluation')
    AND t.assignment_id IS NULL;
  
  -- Проверка 3: Несоответствие статусов
  RETURN QUERY
  SELECT 
    'status_mismatch'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'mismatches', (
        SELECT jsonb_agg(jsonb_build_object(
          'task_id', t.id,
          'task_status', t.status,
          'assignment_id', sa.id,
          'assignment_status', sa.status
        ))
        FROM tasks t
        JOIN survey_360_assignments sa ON t.assignment_id = sa.id
        WHERE (
          (sa.status = 'completed' AND t.status != 'completed')
          OR (sa.status != 'completed' AND t.status = 'completed')
        )
      )
    )
  FROM tasks t
  JOIN survey_360_assignments sa ON t.assignment_id = sa.id
  WHERE (
    (sa.status = 'completed' AND t.status != 'completed')
    OR (sa.status != 'completed' AND t.status = 'completed')
  );
  
  -- Проверка 4: Дублирующиеся assignments
  RETURN QUERY
  SELECT 
    'duplicate_assignments'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'duplicates', (
        SELECT jsonb_agg(jsonb_build_object(
          'evaluated_user', evaluated_user_id,
          'evaluating_user', evaluating_user_id,
          'diagnostic_stage', diagnostic_stage_id,
          'count', cnt,
          'assignment_ids', assignment_ids
        ))
        FROM (
          SELECT 
            evaluated_user_id,
            evaluating_user_id,
            diagnostic_stage_id,
            COUNT(*) as cnt,
            array_agg(id) as assignment_ids
          FROM survey_360_assignments
          WHERE diagnostic_stage_id IS NOT NULL
          GROUP BY evaluated_user_id, evaluating_user_id, diagnostic_stage_id
          HAVING COUNT(*) > 1
        ) dups
      )
    )
  FROM (
    SELECT 
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      COUNT(*) as cnt
    FROM survey_360_assignments
    WHERE diagnostic_stage_id IS NOT NULL
    GROUP BY evaluated_user_id, evaluating_user_id, diagnostic_stage_id
    HAVING COUNT(*) > 1
  ) dups;
END;
$$;

-- 7. Комментарии для документации
COMMENT ON FUNCTION check_diagnostic_data_consistency() IS 
'Проверяет консистентность данных в системе диагностики компетенций. Возвращает список проверок с их статусами.';

COMMENT ON INDEX idx_hard_skill_results_diagnostic_stage IS 
'Индекс для ускорения поиска результатов hard skills по этапу диагностики';

COMMENT ON INDEX idx_soft_skill_results_diagnostic_stage IS 
'Индекс для ускорения поиска результатов soft skills по этапу диагностики';

COMMENT ON INDEX idx_survey_360_assignments_diagnostic_stage IS 
'Индекс для ускорения поиска assignments по этапу диагностики';

COMMENT ON INDEX idx_tasks_diagnostic_stage IS 
'Индекс для ускорения поиска задач по этапу диагностики';

COMMENT ON INDEX idx_user_assessment_results_diagnostic_stage IS 
'Индекс для ускорения поиска агрегированных результатов по этапу диагностики';
