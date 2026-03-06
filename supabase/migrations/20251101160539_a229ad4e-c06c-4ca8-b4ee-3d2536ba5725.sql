-- =====================================================
-- СОЗДАНИЕ ТРИГГЕРОВ ДЛЯ СИСТЕМЫ ДИАГНОСТИКИ КОМПЕТЕНЦИЙ
-- =====================================================

-- 1. Триггер для создания назначений при добавлении участника
DROP TRIGGER IF EXISTS trigger_assign_surveys_to_diagnostic_participant ON diagnostic_stage_participants;
CREATE TRIGGER trigger_assign_surveys_to_diagnostic_participant
  AFTER INSERT ON diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_surveys_to_diagnostic_participant();

-- 2. Триггер для автоматического назначения руководителя
DROP TRIGGER IF EXISTS trigger_auto_assign_manager_for_360 ON survey_360_assignments;
CREATE TRIGGER trigger_auto_assign_manager_for_360
  AFTER INSERT ON survey_360_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_manager_for_360();

-- 3. Триггер для создания задачи при утверждении назначения
DROP TRIGGER IF EXISTS trigger_create_task_on_assignment_approval ON survey_360_assignments;
CREATE TRIGGER trigger_create_task_on_assignment_approval
  AFTER UPDATE ON survey_360_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_task_on_assignment_approval();

-- 4. Триггер для обновления статуса задачи при изменении назначения
DROP TRIGGER IF EXISTS trigger_update_task_status_on_assignment_change ON survey_360_assignments;
CREATE TRIGGER trigger_update_task_status_on_assignment_change
  AFTER UPDATE ON survey_360_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_task_status_on_assignment_change();

-- 5. Триггер для агрегации результатов по качествам
DROP TRIGGER IF EXISTS trigger_aggregate_soft_skill_results ON soft_skill_results;
CREATE TRIGGER trigger_aggregate_soft_skill_results
  AFTER INSERT OR UPDATE ON soft_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION public.aggregate_soft_skill_results();

-- 6. Триггер для агрегации результатов по навыкам
DROP TRIGGER IF EXISTS trigger_aggregate_hard_skill_results ON hard_skill_results;
CREATE TRIGGER trigger_aggregate_hard_skill_results
  AFTER INSERT OR UPDATE ON hard_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION public.aggregate_hard_skill_results();

-- Комментарии для документирования
COMMENT ON TRIGGER trigger_assign_surveys_to_diagnostic_participant ON diagnostic_stage_participants IS 'Создает самооценку и оценку руководителя при добавлении участника в этап диагностики';
COMMENT ON TRIGGER trigger_auto_assign_manager_for_360 ON survey_360_assignments IS 'Автоматически добавляет руководителя как оценивающего для survey_360';
COMMENT ON TRIGGER trigger_create_task_on_assignment_approval ON survey_360_assignments IS 'Создает задачу при утверждении назначения на оценку';
COMMENT ON TRIGGER trigger_update_task_status_on_assignment_change ON survey_360_assignments IS 'Обновляет статус задачи при изменении статуса назначения';
COMMENT ON TRIGGER trigger_aggregate_soft_skill_results ON soft_skill_results IS 'Агрегирует результаты по качествам в user_assessment_results';
COMMENT ON TRIGGER trigger_aggregate_hard_skill_results ON hard_skill_results IS 'Агрегирует результаты по навыкам в user_assessment_results';