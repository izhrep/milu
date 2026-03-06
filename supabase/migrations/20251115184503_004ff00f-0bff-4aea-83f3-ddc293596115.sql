-- Обновляем функцию admin_cleanup_all_data - добавляем очистку parent_stages
DROP FUNCTION IF EXISTS admin_cleanup_all_data() CASCADE;

CREATE OR REPLACE FUNCTION public.admin_cleanup_all_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  result jsonb := '[]'::jsonb;
  deleted_count integer;
BEGIN
  -- Проверка прав доступа
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
  
  -- 13. parent_stages (НОВОЕ: удаляем после diagnostic_stages и meeting_stages)
  DELETE FROM public.parent_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'parent_stages', 'count', deleted_count);
  
  -- 14. user_qualities (очистка пользовательских качеств)
  DELETE FROM public.user_qualities WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'user_qualities', 'count', deleted_count);
  
  -- 15. user_skills (очистка пользовательских навыков)
  DELETE FROM public.user_skills WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'user_skills', 'count', deleted_count);
  
  RETURN result;
END;
$function$;