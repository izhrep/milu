-- Add unique constraint for survey_360_results table to allow upserts
ALTER TABLE survey_360_results 
ADD CONSTRAINT survey_360_results_unique_answer 
UNIQUE (evaluated_user_id, evaluating_user_id, question_id);