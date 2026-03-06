-- Add is_skip column to hard_skill_results
ALTER TABLE hard_skill_results ADD COLUMN IF NOT EXISTS is_skip BOOLEAN DEFAULT FALSE;

-- Add is_skip column to soft_skill_results
ALTER TABLE soft_skill_results ADD COLUMN IF NOT EXISTS is_skip BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN hard_skill_results.is_skip IS 'Indicates if the respondent skipped this question (cannot answer)';
COMMENT ON COLUMN soft_skill_results.is_skip IS 'Indicates if the respondent skipped this question (cannot answer)';

-- Create indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_hard_skill_results_is_skip ON hard_skill_results(is_skip);
CREATE INDEX IF NOT EXISTS idx_soft_skill_results_is_skip ON soft_skill_results(is_skip);