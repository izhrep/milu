-- Исправление функции calculate_diagnostic_stage_progress
-- Проблема: для hard_skill_results использовалось ssr.user_id в JOIN,
-- но поле называется evaluated_user_id

CREATE OR REPLACE FUNCTION public.calculate_diagnostic_stage_progress(stage_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_participants integer;
  completed_skill_surveys integer;
  completed_360_surveys integer;
  total_required integer;
  completed_total integer;
  progress numeric;
BEGIN
  SELECT COUNT(*) INTO total_participants
  FROM diagnostic_stage_participants
  WHERE stage_id = stage_id_param;
  
  IF total_participants = 0 THEN
    RETURN 0;
  END IF;
  
  total_required := total_participants * 2;
  
  SELECT COUNT(DISTINCT ssr.evaluated_user_id) INTO completed_skill_surveys  -- ИСПРАВЛЕНО: было ssr.user_id
  FROM hard_skill_results ssr
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = ssr.evaluated_user_id  -- ИСПРАВЛЕНО: было ssr.user_id
  WHERE dsp.stage_id = stage_id_param;
  
  SELECT COUNT(DISTINCT s360r.evaluated_user_id) INTO completed_360_surveys
  FROM soft_skill_results s360r
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = s360r.evaluated_user_id
  WHERE dsp.stage_id = stage_id_param;
  
  completed_total := completed_skill_surveys + completed_360_surveys;
  progress := (completed_total::numeric / total_required::numeric) * 100;
  
  RETURN ROUND(progress, 2);
END;
$function$;