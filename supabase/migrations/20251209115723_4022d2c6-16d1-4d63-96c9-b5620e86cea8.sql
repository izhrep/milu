
-- First fix existing data that violates new constraint
UPDATE user_skills SET target_level = 4 WHERE target_level > 4;

-- Now fix constraints for Hard Skills (0-4)
ALTER TABLE user_skills DROP CONSTRAINT IF EXISTS user_skills_current_level_check;
ALTER TABLE user_skills ADD CONSTRAINT user_skills_current_level_check CHECK (current_level >= 0 AND current_level <= 4);

ALTER TABLE user_skills DROP CONSTRAINT IF EXISTS user_skills_target_level_check;
ALTER TABLE user_skills ADD CONSTRAINT user_skills_target_level_check CHECK (target_level >= 0 AND target_level <= 4);
