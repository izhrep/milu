-- Allow zero level for grade skills and qualities

-- Drop existing check constraints that require positive values
ALTER TABLE grade_skills DROP CONSTRAINT IF EXISTS check_target_level_positive;
ALTER TABLE grade_qualities DROP CONSTRAINT IF EXISTS check_target_level_positive;

-- Add new check constraints that allow zero or positive values
ALTER TABLE grade_skills ADD CONSTRAINT check_target_level_non_negative 
  CHECK (target_level >= 0);

ALTER TABLE grade_qualities ADD CONSTRAINT check_target_level_non_negative 
  CHECK (target_level >= 0);

-- Update comment to reflect the change
COMMENT ON COLUMN grade_skills.target_level IS 'Target level for skill (0-10, where 0 represents entry/zero level)';
COMMENT ON COLUMN grade_qualities.target_level IS 'Target level for quality (0-10, where 0 represents entry/zero level)';