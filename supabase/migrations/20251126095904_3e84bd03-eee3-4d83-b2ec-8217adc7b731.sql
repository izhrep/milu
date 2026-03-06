-- Add new task types to check_task_type constraint
-- Drop existing constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS check_task_type;

-- Add updated constraint with new task types
ALTER TABLE tasks ADD CONSTRAINT check_task_type 
CHECK (task_type IN (
  'assessment',
  'diagnostic_stage',
  'survey_360_evaluation',
  'peer_selection',
  'peer_approval',
  'meeting',
  'skill_survey',
  'development'
));