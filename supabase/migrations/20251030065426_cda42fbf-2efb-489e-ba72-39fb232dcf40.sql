-- Исправление логики создания участников этапа диагностики и встреч 1:1

-- 1. Обновляем функцию создания заданий для участника диагностики
-- Добавляем создание самооценки 360
CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    'отправлен запрос'
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- 2. Создаем задание на самооценку 360
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'отправлен запрос'
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- 3. Создаем задание на оценку 360 от руководителя (если есть)
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
    AND u.manager_id != NEW.user_id  -- Избегаем дублирования с самооценкой
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 2. Пересоздаем триггер для diagnostic_stage_participants
DROP TRIGGER IF EXISTS on_diagnostic_participant_added ON diagnostic_stage_participants;
CREATE TRIGGER on_diagnostic_participant_added
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION assign_surveys_to_diagnostic_participant();

-- 3. Пересоздаем триггер для обновления прогресса этапа
DROP TRIGGER IF EXISTS on_diagnostic_participant_added_update_stage ON diagnostic_stage_participants;
CREATE TRIGGER on_diagnostic_participant_added_update_stage
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnostic_stage_on_participant_add();

-- 4. Пересоздаем триггер для создания задачи участнику
DROP TRIGGER IF EXISTS on_diagnostic_participant_added_create_task ON diagnostic_stage_participants;
CREATE TRIGGER on_diagnostic_participant_added_create_task
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION create_diagnostic_task_for_participant();

-- 5. Триггеры для обновления статуса этапа при завершении опросов
DROP TRIGGER IF EXISTS update_diagnostic_stage_on_skill_survey ON skill_survey_results;
CREATE TRIGGER update_diagnostic_stage_on_skill_survey
  AFTER INSERT ON skill_survey_results
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnostic_stage_status();

DROP TRIGGER IF EXISTS update_diagnostic_stage_on_360_survey ON survey_360_results;
CREATE TRIGGER update_diagnostic_stage_on_360_survey
  AFTER INSERT ON survey_360_results
  FOR EACH ROW
  EXECUTE FUNCTION update_diagnostic_stage_status();

-- 6. Аналогично для встреч 1:1
DROP TRIGGER IF EXISTS on_meeting_participant_added ON meeting_stage_participants;
CREATE TRIGGER on_meeting_participant_added
  AFTER INSERT ON meeting_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION create_meeting_task_for_participant();

-- 7. Триггер для логирования изменений этапов диагностики
DROP TRIGGER IF EXISTS log_diagnostic_stage_changes_trigger ON diagnostic_stages;
CREATE TRIGGER log_diagnostic_stage_changes_trigger
  AFTER INSERT OR UPDATE ON diagnostic_stages
  FOR EACH ROW
  EXECUTE FUNCTION log_diagnostic_stage_changes();

-- 8. Триггеры для установки evaluation_period
DROP TRIGGER IF EXISTS set_evaluation_period_on_skill_survey ON skill_survey_results;
CREATE TRIGGER set_evaluation_period_on_skill_survey
  BEFORE INSERT ON skill_survey_results
  FOR EACH ROW
  EXECUTE FUNCTION set_evaluation_period();

DROP TRIGGER IF EXISTS set_evaluation_period_on_360_survey ON survey_360_results;
CREATE TRIGGER set_evaluation_period_on_360_survey
  BEFORE INSERT ON survey_360_results
  FOR EACH ROW
  EXECUTE FUNCTION set_evaluation_period();

-- 9. Триггеры для обновления updated_at
DROP TRIGGER IF EXISTS update_diagnostic_stages_updated_at ON diagnostic_stages;
CREATE TRIGGER update_diagnostic_stages_updated_at
  BEFORE UPDATE ON diagnostic_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_stages_updated_at ON meeting_stages;
CREATE TRIGGER update_meeting_stages_updated_at
  BEFORE UPDATE ON meeting_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Триггеры для завершения задач диагностики
DROP TRIGGER IF EXISTS complete_diagnostic_task_on_skill_survey ON skill_survey_results;
CREATE TRIGGER complete_diagnostic_task_on_skill_survey
  AFTER INSERT ON skill_survey_results
  FOR EACH ROW
  EXECUTE FUNCTION complete_diagnostic_task_on_surveys_completion();

DROP TRIGGER IF EXISTS complete_diagnostic_task_on_360_survey ON survey_360_results;
CREATE TRIGGER complete_diagnostic_task_on_360_survey
  AFTER INSERT ON survey_360_results
  FOR EACH ROW
  EXECUTE FUNCTION complete_diagnostic_task_on_surveys_completion();

-- 11. Триггеры для обновления статуса assignments
DROP TRIGGER IF EXISTS update_360_assignment_on_completion ON survey_360_results;
CREATE TRIGGER update_360_assignment_on_completion
  AFTER INSERT ON survey_360_results
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_on_survey_completion();

DROP TRIGGER IF EXISTS update_skill_assignment_on_completion ON skill_survey_results;
CREATE TRIGGER update_skill_assignment_on_completion
  AFTER INSERT ON skill_survey_results
  FOR EACH ROW
  EXECUTE FUNCTION update_skill_assignment_on_survey_completion();

-- 12. Триггеры для обновления user_skills и user_qualities
DROP TRIGGER IF EXISTS update_user_skills_on_survey ON skill_survey_results;
CREATE TRIGGER update_user_skills_on_survey
  AFTER INSERT ON skill_survey_results
  FOR EACH ROW
  EXECUTE FUNCTION update_user_skills_from_survey();

DROP TRIGGER IF EXISTS update_user_qualities_on_survey ON survey_360_results;
CREATE TRIGGER update_user_qualities_on_survey
  AFTER INSERT ON survey_360_results
  FOR EACH ROW
  EXECUTE FUNCTION update_user_qualities_from_survey();

-- 13. Триггер для создания записей в assessment_results
DROP TRIGGER IF EXISTS insert_360_assessment_results ON survey_360_results;
CREATE TRIGGER insert_360_assessment_results
  AFTER INSERT ON survey_360_results
  FOR EACH ROW
  EXECUTE FUNCTION insert_assessment_results();

DROP TRIGGER IF EXISTS insert_skill_assessment_results ON skill_survey_results;
CREATE TRIGGER insert_skill_assessment_results
  AFTER INSERT ON skill_survey_results
  FOR EACH ROW
  EXECUTE FUNCTION insert_assessment_results();

-- 14. Триггер для обновления статуса встреч
DROP TRIGGER IF EXISTS update_meeting_task_on_approval ON one_on_one_meetings;
CREATE TRIGGER update_meeting_task_on_approval
  AFTER UPDATE ON one_on_one_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_task_status();

-- 15. Триггеры для создания задач при создании assignments
DROP TRIGGER IF EXISTS create_task_on_360_assignment ON survey_360_assignments;
CREATE TRIGGER create_task_on_360_assignment
  AFTER INSERT ON survey_360_assignments
  FOR EACH ROW
  EXECUTE FUNCTION create_task_for_assignment();

DROP TRIGGER IF EXISTS create_task_on_skill_assignment ON skill_survey_assignments;
CREATE TRIGGER create_task_on_skill_assignment
  AFTER INSERT ON skill_survey_assignments
  FOR EACH ROW
  EXECUTE FUNCTION create_task_for_skill_assignment();