-- Убираем ON CONFLICT из триггеров агрегации, так как уникальные индексы уже созданы
-- Теперь используем простой INSERT без ON CONFLICT

CREATE OR REPLACE FUNCTION public.aggregate_survey_360_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.evaluated_user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.evaluated_user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by quality and evaluator type
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    quality_id,
    self_assessment,
    peers_average,
    manager_assessment,
    total_responses
  )
  SELECT 
    NEW.evaluated_user_id,
    stage_id,
    eval_period,
    NOW(),
    sq.quality_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.value ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.value 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.value ELSE NULL END),
    COUNT(*)
  FROM survey_360_results sr
  JOIN survey_360_questions sq ON sr.question_id = sq.id
  JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sq.quality_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY sq.quality_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aggregate_skill_survey_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by skill and evaluator type
  INSERT INTO user_assessment_results (
    user_id,
    diagnostic_stage_id,
    assessment_period,
    assessment_date,
    skill_id,
    self_assessment,
    peers_average,
    manager_assessment,
    total_responses
  )
  SELECT 
    NEW.user_id,
    stage_id,
    eval_period,
    NOW(),
    ssq.skill_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.user_id THEN ao.step ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.step 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.step ELSE NULL END),
    COUNT(*)
  FROM skill_survey_results sr
  JOIN skill_survey_questions ssq ON sr.question_id = ssq.id
  JOIN skill_survey_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.user_id = NEW.user_id
    AND ssq.skill_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY ssq.skill_id;
  
  RETURN NEW;
END;
$function$;