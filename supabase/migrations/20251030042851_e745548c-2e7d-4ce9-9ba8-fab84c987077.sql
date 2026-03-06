-- =====================================================
-- КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ: ТРИГГЕРЫ И RLS ДЛЯ ДИАГНОСТИКИ
-- =====================================================

-- 1. СОЗДАНИЕ ТРИГГЕРОВ (они отсутствуют!)
-- =====================================================

-- Триггер для создания задачи при добавлении участника
DROP TRIGGER IF EXISTS trigger_create_diagnostic_task ON diagnostic_stage_participants;
CREATE TRIGGER trigger_create_diagnostic_task
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION create_diagnostic_task_for_participant();

-- Триггер для обновления прогресса этапа при добавлении участника
DROP TRIGGER IF EXISTS trigger_update_stage_on_participant_add ON diagnostic_stage_participants;
CREATE TRIGGER trigger_update_stage_on_participant_add
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnostic_stage_on_participant_add();

-- Триггер для обновления статуса этапа при заполнении survey_360
DROP TRIGGER IF EXISTS trigger_update_stage_on_360_result ON survey_360_results;
CREATE TRIGGER trigger_update_stage_on_360_result
  AFTER INSERT ON survey_360_results
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnostic_stage_status();

-- Триггер для обновления статуса этапа при заполнении skill survey
DROP TRIGGER IF EXISTS trigger_update_stage_on_skill_result ON skill_survey_results;
CREATE TRIGGER trigger_update_stage_on_skill_result
  AFTER INSERT ON skill_survey_results
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnostic_stage_status();

-- 2. ОБНОВЛЕНИЕ RLS ПОЛИТИК
-- =====================================================

-- Удаляем старые слишком открытые политики для diagnostic_stages
DROP POLICY IF EXISTS "Allow all read access to diagnostic_stages" ON diagnostic_stages;
DROP POLICY IF EXISTS "Allow all write access to diagnostic_stages" ON diagnostic_stages;
DROP POLICY IF EXISTS "Everyone can view diagnostic_stages" ON diagnostic_stages;

-- Новые политики для diagnostic_stages
CREATE POLICY "Admins can manage diagnostic stages"
  ON diagnostic_stages
  FOR ALL
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

CREATE POLICY "Managers can view diagnostic stages"
  ON diagnostic_stages
  FOR SELECT
  TO authenticated
  USING (
    is_current_user_admin() 
    OR EXISTS (
      SELECT 1 FROM diagnostic_stage_participants dsp
      JOIN users u ON u.id = dsp.user_id
      WHERE dsp.stage_id = diagnostic_stages.id
        AND u.manager_id = get_current_session_user()
    )
  );

CREATE POLICY "Participants can view their diagnostic stages"
  ON diagnostic_stages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM diagnostic_stage_participants
      WHERE stage_id = diagnostic_stages.id
        AND user_id = get_current_session_user()
    )
  );

-- Удаляем старые политики для diagnostic_stage_participants
DROP POLICY IF EXISTS "Allow all access to diagnostic_stage_participants" ON diagnostic_stage_participants;
DROP POLICY IF EXISTS "Everyone can view diagnostic_stage_participants" ON diagnostic_stage_participants;

-- Новые политики для diagnostic_stage_participants
CREATE POLICY "Admins can manage participants"
  ON diagnostic_stage_participants
  FOR ALL
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

CREATE POLICY "Managers can view their team participants"
  ON diagnostic_stage_participants
  FOR SELECT
  TO authenticated
  USING (
    is_current_user_admin()
    OR is_manager_of_user(user_id)
  );

CREATE POLICY "Users can view their participation"
  ON diagnostic_stage_participants
  FOR SELECT
  TO authenticated
  USING (user_id = get_current_session_user());

-- 3. ДОБАВЛЕНИЕ АВТОМАТИЧЕСКОЙ УСТАНОВКИ evaluation_period
-- =====================================================

-- Триггер для автоматической установки evaluation_period при создании этапа
DROP TRIGGER IF EXISTS set_diagnostic_evaluation_period ON diagnostic_stages;
CREATE TRIGGER set_diagnostic_evaluation_period
  BEFORE INSERT ON diagnostic_stages
  FOR EACH ROW
  EXECUTE FUNCTION set_evaluation_period();

-- 4. ФУНКЦИЯ ДЛЯ АВТОМАТИЧЕСКОГО НАЗНАЧЕНИЯ ОПРОСОВ
-- =====================================================

CREATE OR REPLACE FUNCTION assign_surveys_to_diagnostic_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  evaluator_record RECORD;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM diagnostic_stages
  WHERE id = NEW.stage_id;
  
  IF stage_record.evaluation_period IS NULL THEN
    RAISE EXCEPTION 'Evaluation period not set for diagnostic stage';
  END IF;
  
  -- Назначаем skill survey самому участнику (самооценка)
  INSERT INTO skill_survey_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'отправлен запрос'
  )
  ON CONFLICT DO NOTHING;
  
  -- Назначаем 360 опрос от менеджера (если есть)
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  )
  SELECT 
    NEW.user_id,
    u.manager_id,
    'отправлен запрос'
  FROM users u
  WHERE u.id = NEW.user_id 
    AND u.manager_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Триггер для назначения опросов при добавлении участника
DROP TRIGGER IF EXISTS trigger_assign_surveys_to_participant ON diagnostic_stage_participants;
CREATE TRIGGER trigger_assign_surveys_to_participant
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION assign_surveys_to_diagnostic_participant();

-- 5. ФУНКЦИЯ ДЛЯ ЗАВЕРШЕНИЯ ЗАДАЧИ ДИАГНОСТИКИ
-- =====================================================

CREATE OR REPLACE FUNCTION complete_diagnostic_task_on_surveys_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  has_skill_survey boolean;
  has_360_survey boolean;
BEGIN
  -- Определяем пользователя в зависимости от таблицы
  IF TG_TABLE_NAME = 'skill_survey_results' THEN
    target_user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'survey_360_results' THEN
    target_user_id := NEW.evaluated_user_id;
  END IF;
  
  -- Проверяем наличие обоих опросов
  SELECT EXISTS (
    SELECT 1 FROM skill_survey_results 
    WHERE user_id = target_user_id
    LIMIT 1
  ) INTO has_skill_survey;
  
  SELECT EXISTS (
    SELECT 1 FROM survey_360_results 
    WHERE evaluated_user_id = target_user_id
    LIMIT 1
  ) INTO has_360_survey;
  
  -- Если оба опроса заполнены, завершаем задачу
  IF has_skill_survey AND has_360_survey THEN
    UPDATE tasks
    SET status = 'completed',
        updated_at = now()
    WHERE user_id = target_user_id
      AND task_type = 'assessment'
      AND category = 'Диагностика'
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Триггеры для завершения задачи диагностики
DROP TRIGGER IF EXISTS trigger_complete_diagnostic_task_on_skill ON skill_survey_results;
CREATE TRIGGER trigger_complete_diagnostic_task_on_skill
  AFTER INSERT ON skill_survey_results
  FOR EACH ROW
  EXECUTE FUNCTION complete_diagnostic_task_on_surveys_completion();

DROP TRIGGER IF EXISTS trigger_complete_diagnostic_task_on_360 ON survey_360_results;
CREATE TRIGGER trigger_complete_diagnostic_task_on_360
  AFTER INSERT ON survey_360_results
  FOR EACH ROW
  EXECUTE FUNCTION complete_diagnostic_task_on_surveys_completion();