-- Add visibility restriction fields to hard_skill_questions
ALTER TABLE hard_skill_questions 
ADD COLUMN IF NOT EXISTS visibility_restriction_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS visibility_restriction_type TEXT;

-- Add visibility restriction fields to soft_skill_questions
ALTER TABLE soft_skill_questions 
ADD COLUMN IF NOT EXISTS visibility_restriction_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS visibility_restriction_type TEXT;

-- Add check constraint for valid visibility_restriction_type values
ALTER TABLE hard_skill_questions
ADD CONSTRAINT check_hard_skill_visibility_restriction_type 
CHECK (visibility_restriction_type IS NULL OR visibility_restriction_type IN ('self', 'manager', 'peer'));

ALTER TABLE soft_skill_questions
ADD CONSTRAINT check_soft_skill_visibility_restriction_type 
CHECK (visibility_restriction_type IS NULL OR visibility_restriction_type IN ('self', 'manager', 'peer'));