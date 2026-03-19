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
  -- Проверка прав доступа
  IF NOT has_permission(auth.uid(), 'security.manage') THEN
    RAISE EXCEPTION 'Access denied. security.manage permission required.';
  END IF;
  
  -- Удаляем в правильном порядке с учетом внешних ключей
  
  -- 1. meeting_artifacts (FK → one_on_one_meetings, удалять ДО встреч)
  DELETE FROM public.meeting_artifacts WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_artifacts', 'count', deleted_count);
  
  -- 2. meeting_private_notes (FK → one_on_one_meetings, удалять ДО встреч)
  DELETE FROM public.meeting_private_notes WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_private_notes', 'count', deleted_count);
  
  -- 3. meeting_decisions (FK → one_on_one_meetings, удалять ДО встреч)
  DELETE FROM public.meeting_decisions WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_decisions', 'count', deleted_count);
  
  -- 4. meeting_status_current (FK → one_on_one_meetings, удалять ДО встреч)
  DELETE FROM public.meeting_status_current WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_status_current', 'count', deleted_count);
  
  -- 5. one_on_one_meetings
  DELETE FROM public.one_on_one_meetings WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'one_on_one_meetings', 'count', deleted_count);
  
  -- 6. meeting_stage_participants
  DELETE FROM public.meeting_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stage_participants', 'count', deleted_count);
  
  -- 7. meeting_stages
  DELETE FROM public.meeting_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'meeting_stages', 'count', deleted_count);
  
  -- 8. development_plan_tasks (FK → development_plans, tasks, удалять ДО планов)
  DELETE FROM public.development_plan_tasks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'development_plan_tasks', 'count', deleted_count);
  
  -- 9. development_plans
  DELETE FROM public.development_plans WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'development_plans', 'count', deleted_count);
  
  -- 10. development_tasks
  DELETE FROM public.development_tasks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'development_tasks', 'count', deleted_count);
  
  -- 11. tasks
  DELETE FROM public.tasks WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'tasks', 'count', deleted_count);
  
  -- 12. user_assessment_results
  DELETE FROM public.user_assessment_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'user_assessment_results', 'count', deleted_count);
  
  -- 13. hard_skill_results
  DELETE FROM public.hard_skill_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'hard_skill_results', 'count', deleted_count);
  
  -- 14. soft_skill_results
  DELETE FROM public.soft_skill_results WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'soft_skill_results', 'count', deleted_count);
  
  -- 15. survey_360_assignments
  DELETE FROM public.survey_360_assignments WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'survey_360_assignments', 'count', deleted_count);
  
  -- 16. employee_stage_snapshots (FK → diagnostic_stages, удалять ДО этапов)
  DELETE FROM public.employee_stage_snapshots WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'employee_stage_snapshots', 'count', deleted_count);
  
  -- 17. johari_ai_snapshots (FK → diagnostic_stages, удалять ДО этапов)
  DELETE FROM public.johari_ai_snapshots WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'johari_ai_snapshots', 'count', deleted_count);
  
  -- 18. diagnostic_stage_participants
  DELETE FROM public.diagnostic_stage_participants WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stage_participants', 'count', deleted_count);
  
  -- 19. diagnostic_stages
  DELETE FROM public.diagnostic_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_stages', 'count', deleted_count);
  
  -- 20. diagnostic_config_templates (удалять ПОСЛЕ diagnostic_stages, т.к. FK)
  DELETE FROM public.diagnostic_config_templates WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'diagnostic_config_templates', 'count', deleted_count);
  
  -- 21. parent_stages (удаляем после diagnostic_stages и meeting_stages)
  DELETE FROM public.parent_stages WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'parent_stages', 'count', deleted_count);
  
  -- 22. user_qualities
  DELETE FROM public.user_qualities WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'user_qualities', 'count', deleted_count);
  
  -- 23. user_skills
  DELETE FROM public.user_skills WHERE TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  result := result || jsonb_build_object('table', 'user_skills', 'count', deleted_count);
  
  RETURN result;
END;
$function$;