-- =====================================================
-- УДАЛЕНИЕ ДУБЛИКАТОВ ТРИГГЕРОВ
-- =====================================================

-- Удаляем старые триггеры с короткими именами
DROP TRIGGER IF EXISTS trigger_auto_assign_manager_360 ON survey_360_assignments;
DROP TRIGGER IF EXISTS trigger_create_task_on_approval ON survey_360_assignments;
DROP TRIGGER IF EXISTS trigger_update_task_status ON survey_360_assignments;

-- Оставляем только триггеры с полными именами