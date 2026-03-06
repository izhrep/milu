-- =====================================================
-- FINAL CLEANUP: Remove all old role-based functions
-- Replace with permission-based equivalents
-- =====================================================
-- Date: 2025-11-13
-- Issue: Found 2 functions still using deprecated is_current_user_admin()
-- Solution: Replace with has_permission('security.manage')
-- =====================================================

-- =====================================================
-- STEP 1: UPDATE admin_cleanup_all_data()
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_cleanup_all_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  deleted_count integer;
BEGIN
  -- ✅ НОВАЯ ПРОВЕРКА: Используем permission вместо role
  IF NOT has_permission('security.manage', get_current_user_id()) THEN
    RAISE EXCEPTION 'Access denied. security.manage permission required.';
  END IF;
  
  -- Удаляем в правильном порядке с учетом внешних ключей
  
  -- 1. meeting_decisions (зависит от one_on_one_meetings)
  DELETE FROM public.meeting_decisions WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_decisions', 'count', deleted_count);
  
  -- 2. one_on_one_meetings (зависит от meeting_stages)
  DELETE FROM public.one_on_one_meetings WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'one_on_one_meetings', 'count', deleted_count);
  
  -- 3. meeting_stage_participants (зависит от meeting_stages)
  DELETE FROM public.meeting_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stage_participants', 'count', deleted_count);
  
  -- 4. meeting_stages
  DELETE FROM public.meeting_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stages', 'count', deleted_count);
  
  -- 5. diagnostic_stage_participants (зависит от diagnostic_stages)
  DELETE FROM public.diagnostic_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stage_participants', 'count', deleted_count);
  
  -- 6. diagnostic_stages
  DELETE FROM public.diagnostic_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stages', 'count', deleted_count);
  
  -- 7. tasks (может иметь зависимости от assignments)
  DELETE FROM public.tasks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'tasks', 'count', deleted_count);
  
  -- 8. soft_skill_results (survey_360_results)
  DELETE FROM public.soft_skill_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'soft_skill_results', 'count', deleted_count);
  
  -- 9. hard_skill_results (skill_survey_results)
  DELETE FROM public.hard_skill_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'hard_skill_results', 'count', deleted_count);
  
  -- 10. user_assessment_results
  DELETE FROM public.user_assessment_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'user_assessment_results', 'count', deleted_count);
  
  -- 11. survey_360_assignments
  DELETE FROM public.survey_360_assignments WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'survey_360_assignments', 'count', deleted_count);
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.admin_cleanup_all_data() IS 
'Admin cleanup function - deletes all operational data. Requires security.manage permission. Uses permission-based access control.';

-- =====================================================
-- STEP 2: UPDATE admin_delete_all_from_table()
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_delete_all_from_table(table_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
  sql_query text;
BEGIN
  -- ✅ НОВАЯ ПРОВЕРКА: Используем permission вместо role
  IF NOT has_permission('security.manage', get_current_user_id()) THEN
    RAISE EXCEPTION 'Access denied. security.manage permission required.';
  END IF;
  
  -- Формируем SQL запрос с полным путем к таблице
  sql_query := format('DELETE FROM public.%I', table_name);
  
  -- Выполняем удаление
  EXECUTE sql_query;
  
  -- Получаем количество удаленных строк
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.admin_delete_all_from_table(text) IS 
'Admin delete function - deletes all rows from specified table. Requires security.manage permission. Uses permission-based access control.';

-- =====================================================
-- VERIFICATION SUMMARY
-- =====================================================

-- ✅ Функции обновлены:
-- 1. admin_cleanup_all_data() - теперь использует has_permission('security.manage')
-- 2. admin_delete_all_from_table() - теперь использует has_permission('security.manage')
--
-- ❌ Старые функции (удалены в предыдущих миграциях):
-- - is_current_user_admin() - удалена
-- - is_current_user_hr() - удалена  
-- - is_manager_of_user() - удалена
-- - check_user_has_auth() - удалена
--
-- ✅ Все функции теперь используют permission-based модель
-- ✅ Нет зависимостей от старых ролевых функций
-- =====================================================