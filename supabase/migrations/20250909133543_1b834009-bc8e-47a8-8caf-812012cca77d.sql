-- Fix the insert_assessment_results function to avoid upsert conflict
CREATE OR REPLACE FUNCTION public.insert_assessment_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- For survey 360 results
  IF TG_TABLE_NAME = 'survey_360_results' THEN
    -- First delete existing record for this combination to avoid conflicts
    DELETE FROM user_assessment_results 
    WHERE user_id = NEW.evaluated_user_id 
      AND assessment_type = 'survey_360'
      AND assessment_period = NEW.evaluation_period
      AND quality_id = (SELECT quality_id FROM survey_360_questions WHERE id = NEW.question_id);
    
    -- Calculate average for this quality for this user
    INSERT INTO user_assessment_results (
      user_id,
      assessment_type,
      assessment_period,
      assessment_date,
      quality_id,
      quality_average,
      total_responses
    )
    SELECT 
      NEW.evaluated_user_id,
      'survey_360',
      NEW.evaluation_period,
      NEW.created_at,
      sq.quality_id,
      AVG(ao.value),
      COUNT(*)
    FROM survey_360_results sr
    JOIN survey_360_questions sq ON sr.question_id = sq.id
    JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
      AND sq.quality_id IS NOT NULL
      AND sr.evaluation_period = NEW.evaluation_period
    GROUP BY sq.quality_id;
  END IF;
  
  -- For skill survey results  
  IF TG_TABLE_NAME = 'skill_survey_results' THEN
    -- First delete existing record for this combination to avoid conflicts
    DELETE FROM user_assessment_results 
    WHERE user_id = NEW.user_id 
      AND assessment_type = 'skill_survey'
      AND assessment_period = NEW.evaluation_period
      AND skill_id = (SELECT skill_id FROM skill_survey_questions WHERE id = NEW.question_id);
    
    INSERT INTO user_assessment_results (
      user_id,
      assessment_type,
      assessment_period,
      assessment_date,
      skill_id,
      skill_average,
      total_responses
    )
    SELECT 
      NEW.user_id,
      'skill_survey',
      NEW.evaluation_period,
      NEW.created_at,
      ssq.skill_id,
      AVG(ao.step),
      COUNT(*)
    FROM skill_survey_results sr
    JOIN skill_survey_questions ssq ON sr.question_id = ssq.id
    JOIN skill_survey_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.user_id = NEW.user_id 
      AND ssq.skill_id IS NOT NULL
      AND sr.evaluation_period = NEW.evaluation_period
    GROUP BY ssq.skill_id;
  END IF;
  
  RETURN NEW;
END;
$function$