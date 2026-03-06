-- ============================================
-- КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Убрать второй параметр из has_permission()
-- ============================================

-- Текущая функция has_permission принимает только один параметр (permission_name)
-- и автоматически использует get_current_user_id() внутри.
-- Все старые вызовы с двумя параметрами нужно исправить.

-- ============================================
-- ИСПРАВЛЕНИЕ 1: admin_cleanup_all_data()
-- ============================================

DROP FUNCTION IF EXISTS public.admin_cleanup_all_data() CASCADE;

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
  -- ✅ ИСПРАВЛЕНО: has_permission без второго параметра
  IF NOT has_permission('security.manage') THEN
    RAISE EXCEPTION 'Access denied. security.manage permission required.';
  END IF;
  
  -- Удаляем в правильном порядке с учетом внешних ключей
  
  -- 1. meeting_decisions (зависит от one_on_one_meetings)
  DELETE FROM public.meeting_decisions WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_decisions', 'count', deleted_count);
  
  -- 2. one_on_one_meetings
  DELETE FROM public.one_on_one_meetings WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'one_on_one_meetings', 'count', deleted_count);
  
  -- 3. meeting_stage_participants
  DELETE FROM public.meeting_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stage_participants', 'count', deleted_count);
  
  -- 4. meeting_stages
  DELETE FROM public.meeting_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stages', 'count', deleted_count);
  
  -- 5. development_tasks (зависит от users)
  DELETE FROM public.development_tasks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'development_tasks', 'count', deleted_count);
  
  -- 6. tasks
  DELETE FROM public.tasks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'tasks', 'count', deleted_count);
  
  -- 7. user_assessment_results
  DELETE FROM public.user_assessment_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'user_assessment_results', 'count', deleted_count);
  
  -- 8. hard_skill_results
  DELETE FROM public.hard_skill_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'hard_skill_results', 'count', deleted_count);
  
  -- 9. soft_skill_results
  DELETE FROM public.soft_skill_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'soft_skill_results', 'count', deleted_count);
  
  -- 10. survey_360_assignments
  DELETE FROM public.survey_360_assignments WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'survey_360_assignments', 'count', deleted_count);
  
  -- 11. diagnostic_stage_participants
  DELETE FROM public.diagnostic_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stage_participants', 'count', deleted_count);
  
  -- 12. diagnostic_stages
  DELETE FROM public.diagnostic_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stages', 'count', deleted_count);
  
  RETURN result;
END;
$$;

-- ============================================
-- ИСПРАВЛЕНИЕ 2: admin_delete_all_from_table()
-- ============================================

DROP FUNCTION IF EXISTS public.admin_delete_all_from_table(text) CASCADE;

CREATE OR REPLACE FUNCTION public.admin_delete_all_from_table(table_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
  sql_query text;
BEGIN
  -- ✅ ИСПРАВЛЕНО: has_permission без второго параметра
  IF NOT has_permission('security.manage') THEN
    RAISE EXCEPTION 'Access denied. security.manage permission required.';
  END IF;
  
  -- Формируем SQL запрос с полным путем к таблице
  sql_query := format('DELETE FROM public.%I', table_name);
  
  -- Выполняем удаление
  EXECUTE sql_query;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Возвращаем результат
  RETURN jsonb_build_object(
    'table', table_name,
    'deleted_count', deleted_count,
    'status', 'success'
  );
END;
$$;