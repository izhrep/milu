-- Drop sub_skill_id column from skill_survey_questions
ALTER TABLE skill_survey_questions DROP COLUMN IF EXISTS sub_skill_id;

-- Drop sub_skills table
DROP TABLE IF EXISTS sub_skills CASCADE;