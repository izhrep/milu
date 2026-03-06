-- ============================================
-- FIX BUG 1 & BUG 2: Update unique constraint to include diagnostic_stage_id
-- This ensures assignments are properly isolated between stages
-- ============================================

-- Step 1: Drop old unique constraints that don't include diagnostic_stage_id
ALTER TABLE public.survey_360_assignments 
DROP CONSTRAINT IF EXISTS survey_360_assignments_evaluated_evaluating_unique;

ALTER TABLE public.survey_360_assignments 
DROP CONSTRAINT IF EXISTS survey_360_assignments_evaluated_user_id_evaluating_user_id_key;

-- Step 2: Create new unique constraint that includes diagnostic_stage_id
ALTER TABLE public.survey_360_assignments 
ADD CONSTRAINT survey_360_assignments_per_stage_unique 
UNIQUE (evaluated_user_id, evaluating_user_id, diagnostic_stage_id);
