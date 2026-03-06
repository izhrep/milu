
-- Update all hard_skill_results to is_draft=false
UPDATE hard_skill_results
SET is_draft = false, updated_at = now()
WHERE is_draft = true;

-- Update all soft_skill_results to is_draft=false  
UPDATE soft_skill_results
SET is_draft = false, updated_at = now()
WHERE is_draft = true;
