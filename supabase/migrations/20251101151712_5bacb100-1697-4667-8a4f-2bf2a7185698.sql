-- Fix assignment_type constraint to include all valid values
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assignment_type_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_assignment_type_check 
CHECK (assignment_type = ANY (ARRAY['self'::text, 'manager'::text, 'peer'::text, 'survey_360'::text, 'skill_survey'::text]));