-- Create table for storing assessment results history with averages
CREATE TABLE public.user_assessment_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('survey_360', 'skill_survey')),
  assessment_period TEXT,
  assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Quality results (for survey 360)
  quality_id UUID,
  quality_average NUMERIC,
  
  -- Skill results (for skill survey)  
  skill_id UUID,
  skill_average NUMERIC,
  
  -- Additional metadata
  total_responses INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CHECK (
    (assessment_type = 'survey_360' AND quality_id IS NOT NULL AND skill_id IS NULL) OR
    (assessment_type = 'skill_survey' AND skill_id IS NOT NULL AND quality_id IS NULL)
  )
);

-- Enable RLS
ALTER TABLE public.user_assessment_results ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own assessment results" 
ON user_assessment_results 
FOR SELECT 
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can manage all assessment results" 
ON user_assessment_results 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create function to insert assessment results after survey completion
CREATE OR REPLACE FUNCTION public.insert_assessment_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- For survey 360 results
  IF TG_TABLE_NAME = 'survey_360_results' THEN
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
    GROUP BY sq.quality_id
    ON CONFLICT (user_id, assessment_type, assessment_period, quality_id) 
    DO UPDATE SET 
      quality_average = EXCLUDED.quality_average,
      total_responses = EXCLUDED.total_responses,
      assessment_date = EXCLUDED.assessment_date,
      updated_at = now();
  END IF;
  
  -- For skill survey results  
  IF TG_TABLE_NAME = 'skill_survey_results' THEN
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
    GROUP BY ssq.skill_id
    ON CONFLICT (user_id, assessment_type, assessment_period, skill_id) 
    DO UPDATE SET 
      skill_average = EXCLUDED.skill_average,
      total_responses = EXCLUDED.total_responses,
      assessment_date = EXCLUDED.assessment_date,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER assessment_results_survey_360_trigger
    AFTER INSERT ON survey_360_results
    FOR EACH ROW
    EXECUTE FUNCTION insert_assessment_results();

CREATE TRIGGER assessment_results_skill_survey_trigger
    AFTER INSERT ON skill_survey_results
    FOR EACH ROW
    EXECUTE FUNCTION insert_assessment_results();

-- Add unique constraint for assessment results
CREATE UNIQUE INDEX user_assessment_results_unique_quality 
ON user_assessment_results (user_id, assessment_type, assessment_period, quality_id) 
WHERE quality_id IS NOT NULL;

CREATE UNIQUE INDEX user_assessment_results_unique_skill 
ON user_assessment_results (user_id, assessment_type, assessment_period, skill_id) 
WHERE skill_id IS NOT NULL;

-- Populate existing data for the current user
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
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'survey_360',
  'H2_2025',
  MAX(sr.created_at),
  sq.quality_id,
  AVG(ao.value),
  COUNT(*)
FROM survey_360_results sr
JOIN survey_360_questions sq ON sr.question_id = sq.id
JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
WHERE sr.evaluated_user_id = '550e8400-e29b-41d4-a716-446655440000'
  AND sq.quality_id IS NOT NULL
GROUP BY sq.quality_id
ON CONFLICT DO NOTHING;