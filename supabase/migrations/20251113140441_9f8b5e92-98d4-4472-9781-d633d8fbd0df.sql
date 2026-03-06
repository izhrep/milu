-- ========================================
-- ПОЛНОЕ ИСПРАВЛЕНИЕ СИСТЕМЫ ДИАГНОСТИКИ (ЧАСТЬ 1)
-- Удаление всех триггеров перед пересозданием
-- ========================================

-- Удаляем ВСЕ триггеры на diagnostic_stage_participants
DROP TRIGGER IF EXISTS handle_diagnostic_participant_added_trigger ON diagnostic_stage_participants CASCADE;
DROP TRIGGER IF EXISTS create_diagnostic_task_on_participant_add ON diagnostic_stage_participants CASCADE;
DROP TRIGGER IF EXISTS on_diagnostic_participant_added ON diagnostic_stage_participants CASCADE;
DROP TRIGGER IF EXISTS trigger_assign_surveys_to_diagnostic_participant ON diagnostic_stage_participants CASCADE;
DROP TRIGGER IF EXISTS delete_diagnostic_tasks_on_participant_remove ON diagnostic_stage_participants CASCADE;
DROP TRIGGER IF EXISTS delete_diagnostic_tasks_on_participant_remove_trigger ON diagnostic_stage_participants CASCADE;

-- Удаляем ВСЕ триггеры на diagnostic_stages
DROP TRIGGER IF EXISTS log_diagnostic_stage_changes_trigger ON diagnostic_stages CASCADE;
DROP TRIGGER IF EXISTS trigger_log_diagnostic_stage_changes ON diagnostic_stages CASCADE;
DROP TRIGGER IF EXISTS set_diagnostic_evaluation_period ON diagnostic_stages CASCADE;
DROP TRIGGER IF EXISTS update_diagnostic_stages_updated_at ON diagnostic_stages CASCADE;

-- Удаляем ВСЕ триггеры на hard_skill_results
DROP TRIGGER IF EXISTS set_evaluation_period_on_skill_survey ON hard_skill_results CASCADE;
DROP TRIGGER IF EXISTS trigger_set_evaluation_period_skill_survey ON hard_skill_results CASCADE;
DROP TRIGGER IF EXISTS aggregate_hard_skill_results_trigger ON hard_skill_results CASCADE;
DROP TRIGGER IF EXISTS trigger_aggregate_hard_skill_results ON hard_skill_results CASCADE;
DROP TRIGGER IF EXISTS complete_task_on_hard_skill_result ON hard_skill_results CASCADE;
DROP TRIGGER IF EXISTS update_stage_on_hard_skill_result ON hard_skill_results CASCADE;
DROP TRIGGER IF EXISTS update_user_skills_trigger ON hard_skill_results CASCADE;

-- Удаляем ВСЕ триггеры на soft_skill_results
DROP TRIGGER IF EXISTS set_evaluation_period_on_360_survey ON soft_skill_results CASCADE;
DROP TRIGGER IF EXISTS trigger_set_evaluation_period_survey_360 ON soft_skill_results CASCADE;
DROP TRIGGER IF EXISTS aggregate_soft_skill_results_trigger ON soft_skill_results CASCADE;
DROP TRIGGER IF EXISTS trigger_aggregate_soft_skill_results ON soft_skill_results CASCADE;
DROP TRIGGER IF EXISTS complete_task_on_soft_skill_result ON soft_skill_results CASCADE;
DROP TRIGGER IF EXISTS update_stage_on_soft_skill_result ON soft_skill_results CASCADE;
DROP TRIGGER IF EXISTS update_user_qualities_trigger ON soft_skill_results CASCADE;
DROP TRIGGER IF EXISTS update_360_assignment_on_completion ON soft_skill_results CASCADE;
DROP TRIGGER IF EXISTS update_assignment_on_survey_result ON soft_skill_results CASCADE;
DROP TRIGGER IF EXISTS update_assignment_on_survey_completion_trigger ON soft_skill_results CASCADE;

-- Удаляем ВСЕ триггеры на survey_360_assignments
DROP TRIGGER IF EXISTS update_survey_360_assignments_updated_at ON survey_360_assignments CASCADE;
DROP TRIGGER IF EXISTS create_task_on_assignment_approval_trigger ON survey_360_assignments CASCADE;
DROP TRIGGER IF EXISTS trigger_create_task_on_assignment_approval ON survey_360_assignments CASCADE;
DROP TRIGGER IF EXISTS trigger_update_task_status_on_assignment_change ON survey_360_assignments CASCADE;
DROP TRIGGER IF EXISTS update_task_on_assignment_status_change ON survey_360_assignments CASCADE;
DROP TRIGGER IF EXISTS trigger_auto_assign_manager_for_360 ON survey_360_assignments CASCADE;

-- Удаляем ВСЕ триггеры на one_on_one_meetings
DROP TRIGGER IF EXISTS update_meeting_task_on_approval ON one_on_one_meetings CASCADE;
DROP TRIGGER IF EXISTS update_task_status_on_meeting_approval ON one_on_one_meetings CASCADE;