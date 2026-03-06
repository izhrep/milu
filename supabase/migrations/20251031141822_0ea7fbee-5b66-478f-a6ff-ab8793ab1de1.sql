-- Drop existing triggers first
DROP TRIGGER IF EXISTS trg_insert_assessment_results_360 ON survey_360_results;
DROP TRIGGER IF EXISTS trg_insert_assessment_results_skill ON skill_survey_results;
DROP TRIGGER IF EXISTS assessment_results_survey_360_trigger ON survey_360_results;
DROP TRIGGER IF EXISTS assessment_results_skill_survey_trigger ON skill_survey_results;
DROP TRIGGER IF EXISTS insert_360_assessment_results ON survey_360_results;
DROP TRIGGER IF EXISTS insert_skill_assessment_results ON skill_survey_results;

-- Now drop function with CASCADE to handle any remaining dependencies
DROP FUNCTION IF EXISTS insert_assessment_results() CASCADE;

-- Recreate user_assessment_results table with new structure
DROP TABLE IF EXISTS user_assessment_results CASCADE;

CREATE TABLE user_assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  diagnostic_stage_id UUID REFERENCES diagnostic_stages(id) ON DELETE CASCADE,
  assessment_period TEXT,
  assessment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Competency references
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  quality_id UUID REFERENCES qualities(id) ON DELETE CASCADE,
  
  -- Assessment values by type
  self_assessment NUMERIC,
  peers_average NUMERIC,
  manager_assessment NUMERIC,
  
  -- Metadata
  total_responses INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraints
  CONSTRAINT check_competency_type CHECK (
    (skill_id IS NOT NULL AND quality_id IS NULL) OR 
    (skill_id IS NULL AND quality_id IS NOT NULL)
  ),
  CONSTRAINT unique_user_competency_period UNIQUE (user_id, skill_id, quality_id, assessment_period, diagnostic_stage_id)
);

-- Enable RLS
ALTER TABLE user_assessment_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own assessment results"
  ON user_assessment_results
  FOR SELECT
  USING (
    user_id = get_current_session_user() OR 
    is_current_user_admin() OR 
    is_manager_of_user(user_id)
  );

CREATE POLICY "System can insert assessment results"
  ON user_assessment_results
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update assessment results"
  ON user_assessment_results
  FOR UPDATE
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_assessment_results_user ON user_assessment_results(user_id);
CREATE INDEX idx_assessment_results_stage ON user_assessment_results(diagnostic_stage_id);
CREATE INDEX idx_assessment_results_period ON user_assessment_results(assessment_period);

-- Function to aggregate survey_360 results by evaluator type
CREATE OR REPLACE FUNCTION aggregate_survey_360_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Function to aggregate skill_survey results by evaluator type
CREATE OR REPLACE FUNCTION aggregate_skill_survey_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Create triggers
CREATE TRIGGER trg_aggregate_survey_360_results
  AFTER INSERT ON survey_360_results
  FOR EACH ROW
  EXECUTE FUNCTION aggregate_survey_360_results();

CREATE TRIGGER trg_aggregate_skill_survey_results
  AFTER INSERT ON skill_survey_results
  FOR EACH ROW
  EXECUTE FUNCTION aggregate_skill_survey_results();

-- Update trigger for updated_at
CREATE TRIGGER update_user_assessment_results_updated_at
  BEFORE UPDATE ON user_assessment_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();