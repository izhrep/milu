-- ========================================
-- ПОЛНОЕ ИСПРАВЛЕНИЕ СИСТЕМЫ ДИАГНОСТИКИ (ЧАСТЬ 3)
-- Создание триггеров и исправление данных
-- ========================================

-- СОЗДАНИЕ ТРИГГЕРОВ
-- ==================

-- Триггеры для diagnostic_stage_participants
CREATE TRIGGER handle_diagnostic_participant_added_trigger
AFTER INSERT ON diagnostic_stage_participants
FOR EACH ROW EXECUTE FUNCTION handle_diagnostic_participant_added();

CREATE TRIGGER delete_diagnostic_tasks_on_participant_remove
AFTER DELETE ON diagnostic_stage_participants
FOR EACH ROW EXECUTE FUNCTION delete_diagnostic_tasks_on_participant_remove();

-- Триггеры для diagnostic_stages
CREATE TRIGGER set_diagnostic_evaluation_period
BEFORE INSERT ON diagnostic_stages
FOR EACH ROW EXECUTE FUNCTION set_evaluation_period();

CREATE TRIGGER update_diagnostic_stages_updated_at
BEFORE UPDATE ON diagnostic_stages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER log_diagnostic_stage_changes_trigger
AFTER INSERT OR UPDATE ON diagnostic_stages
FOR EACH ROW EXECUTE FUNCTION log_diagnostic_stage_changes();

-- Триггеры для hard_skill_results
CREATE TRIGGER set_evaluation_period_on_skill_survey
BEFORE INSERT ON hard_skill_results
FOR EACH ROW EXECUTE FUNCTION set_evaluation_period();

CREATE TRIGGER aggregate_hard_skill_results_trigger
AFTER INSERT OR UPDATE ON hard_skill_results
FOR EACH ROW EXECUTE FUNCTION aggregate_hard_skill_results();

CREATE TRIGGER complete_task_on_hard_skill_result
AFTER INSERT ON hard_skill_results
FOR EACH ROW EXECUTE FUNCTION complete_diagnostic_task_on_surveys_completion();

CREATE TRIGGER update_user_skills_trigger
AFTER INSERT OR UPDATE ON hard_skill_results
FOR EACH ROW EXECUTE FUNCTION update_user_skills_from_survey();

-- Триггеры для soft_skill_results
CREATE TRIGGER set_evaluation_period_on_360_survey
BEFORE INSERT ON soft_skill_results
FOR EACH ROW EXECUTE FUNCTION set_evaluation_period();

CREATE TRIGGER aggregate_soft_skill_results_trigger
AFTER INSERT OR UPDATE ON soft_skill_results
FOR EACH ROW EXECUTE FUNCTION aggregate_soft_skill_results();

CREATE TRIGGER complete_task_on_soft_skill_result
AFTER INSERT ON soft_skill_results
FOR EACH ROW EXECUTE FUNCTION complete_diagnostic_task_on_surveys_completion();

CREATE TRIGGER update_user_qualities_trigger
AFTER INSERT OR UPDATE ON soft_skill_results
FOR EACH ROW EXECUTE FUNCTION update_user_qualities_from_survey();

CREATE TRIGGER update_assignment_on_survey_completion_trigger
AFTER INSERT OR UPDATE ON soft_skill_results
FOR EACH ROW EXECUTE FUNCTION update_assignment_on_survey_completion();

-- Триггеры для survey_360_assignments
CREATE TRIGGER update_survey_360_assignments_updated_at
BEFORE UPDATE ON survey_360_assignments
FOR EACH ROW EXECUTE FUNCTION update_survey_360_selections_updated_at();

CREATE TRIGGER create_task_on_assignment_approval_trigger
AFTER INSERT OR UPDATE ON survey_360_assignments
FOR EACH ROW EXECUTE FUNCTION create_task_on_assignment_approval();

CREATE TRIGGER update_task_on_assignment_status_change
AFTER UPDATE ON survey_360_assignments
FOR EACH ROW EXECUTE FUNCTION update_task_status_on_assignment_change();

-- Триггеры для one_on_one_meetings
CREATE TRIGGER update_meeting_task_on_approval
AFTER UPDATE ON one_on_one_meetings
FOR EACH ROW EXECUTE FUNCTION update_meeting_task_status();

-- ИСПРАВЛЕНИЕ ДАННЫХ В БАЗЕ
-- ==========================

-- 1. Обновляем все задачи диагностики, чтобы category было 'assessment'
UPDATE tasks
SET category = 'assessment'
WHERE task_type IN ('diagnostic_stage', 'survey_360_evaluation', 'skill_survey')
  AND category != 'assessment';

-- 2. Обновляем статусы назначений, у которых есть результаты, но статус не 'completed'
UPDATE survey_360_assignments sa
SET status = 'completed', updated_at = now()
WHERE sa.status != 'completed'
  AND EXISTS (
    SELECT 1 FROM soft_skill_results ssr
    WHERE ssr.assignment_id = sa.id
      AND ssr.is_draft = false
  );

-- 3. Обновляем статусы задач, у которых assignment completed, но задача pending
UPDATE tasks t
SET status = 'completed', updated_at = now()
FROM survey_360_assignments sa
WHERE t.assignment_id = sa.id
  AND sa.status = 'completed'
  AND t.status != 'completed';

-- 4. Убеждаемся, что у всех self-assignments есть diagnostic_stage_id
UPDATE survey_360_assignments sa
SET diagnostic_stage_id = dsp.stage_id
FROM diagnostic_stage_participants dsp
WHERE sa.evaluated_user_id = dsp.user_id
  AND sa.evaluating_user_id = dsp.user_id
  AND sa.assignment_type = 'self'
  AND sa.diagnostic_stage_id IS NULL;

-- 5. Убеждаемся, что у всех manager-assignments есть diagnostic_stage_id
UPDATE survey_360_assignments sa
SET diagnostic_stage_id = dsp.stage_id
FROM diagnostic_stage_participants dsp, users u
WHERE sa.evaluated_user_id = dsp.user_id
  AND sa.evaluating_user_id = u.manager_id
  AND sa.assignment_type = 'manager'
  AND sa.diagnostic_stage_id IS NULL
  AND dsp.user_id = u.id;

-- 6. Обновляем все назначения peer, у которых нет diagnostic_stage_id
UPDATE survey_360_assignments sa
SET diagnostic_stage_id = dsp.stage_id
FROM diagnostic_stage_participants dsp
WHERE sa.evaluated_user_id = dsp.user_id
  AND sa.assignment_type = 'peer'
  AND sa.diagnostic_stage_id IS NULL;

-- КОММЕНТАРИИ К ФУНКЦИЯМ
-- ======================
COMMENT ON FUNCTION public.handle_diagnostic_participant_added IS 'Создаёт self и manager assignments + задачи при добавлении участника в диагностический этап';
COMMENT ON FUNCTION public.aggregate_hard_skill_results IS 'Агрегирует результаты hard skills в user_assessment_results';
COMMENT ON FUNCTION public.aggregate_soft_skill_results IS 'Агрегирует результаты soft skills в user_assessment_results';
COMMENT ON FUNCTION public.update_assignment_on_survey_completion IS 'Обновляет статус assignment при завершении опроса';
COMMENT ON FUNCTION public.update_task_status_on_assignment_change IS 'Обновляет статус задачи при изменении статуса assignment';
COMMENT ON FUNCTION public.create_task_on_assignment_approval IS 'Создаёт задачу при утверждении assignment (только вне diagnostic stage)';