-- Обновляем функцию admin_cleanup_all_data, добавляя survey_360_assignments и user_assessment_results
CREATE OR REPLACE FUNCTION public.admin_cleanup_all_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb := '[]'::jsonb;
  deleted_count integer;
BEGIN
  -- Проверяем, что текущий пользователь - администратор
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
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
  
  -- 8. survey_360_results
  DELETE FROM public.survey_360_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'survey_360_results', 'count', deleted_count);
  
  -- 9. skill_survey_results
  DELETE FROM public.skill_survey_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'skill_survey_results', 'count', deleted_count);
  
  -- 10. user_assessment_results
  DELETE FROM public.user_assessment_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'user_assessment_results', 'count', deleted_count);
  
  -- 11. survey_360_assignments (НОВОЕ)
  DELETE FROM public.survey_360_assignments WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'survey_360_assignments', 'count', deleted_count);
  
  -- 12. skill_survey_assignments (для полноты)
  DELETE FROM public.skill_survey_assignments WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'skill_survey_assignments', 'count', deleted_count);
  
  -- 13. career_tracks
  DELETE FROM public.career_tracks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'career_tracks', 'count', deleted_count);
  
  RETURN result;
END;
$function$;