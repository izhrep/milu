
-- Fix aggregate_soft_skill_results to run with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.aggregate_soft_skill_results()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  stage_id := NEW.diagnostic_stage_id;
  IF stage_id IS NULL THEN RETURN NEW; END IF;
  
  SELECT u.manager_id INTO manager_id FROM users u WHERE u.id = NEW.evaluated_user_id;
  
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id AND quality_id IS NOT NULL;
  
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, quality_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, stage_id, get_evaluation_period(NOW()), NOW(), sq.quality_id,
    -- Самооценка: только оценки, где evaluating = evaluated
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    -- Оценка руководителя: только оценки от manager_id
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    -- Peer-оценки: ВСЕ остальные оценки с is_draft=false (без фильтрации по структуре подчинённости)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value ELSE NULL 
    END),
    COUNT(*)
  FROM soft_skill_results sr
  JOIN soft_skill_questions sq ON sr.question_id = sq.id
  JOIN soft_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND sq.quality_id IS NOT NULL
  GROUP BY sq.quality_id;
  
  RETURN NEW;
END;
$function$;

-- Also fix update_user_qualities_from_survey (already has SECURITY DEFINER but verify)
-- and update_diagnostic_stage_on_results_change
CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_on_results_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stage_id_val uuid;
  new_progress numeric;
  new_status text;
BEGIN
  -- Получаем stage_id из NEW или OLD
  IF TG_OP = 'DELETE' THEN
    stage_id_val := OLD.diagnostic_stage_id;
  ELSE
    stage_id_val := NEW.diagnostic_stage_id;
  END IF;
  
  -- Пересчитываем прогресс только если есть stage_id
  IF stage_id_val IS NOT NULL THEN
    new_progress := calculate_diagnostic_stage_progress(stage_id_val);
    
    IF new_progress = 0 THEN
      new_status := 'setup';
    ELSIF new_progress >= 100 THEN
      new_status := 'completed';
    ELSE
      new_status := 'assessment';
    END IF;
    
    UPDATE diagnostic_stages
    SET progress_percent = new_progress,
        status = new_status,
        updated_at = now()
    WHERE id = stage_id_val;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;
