
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

-- Step 3: Create missing self assignment for Yurasova in the current stage
INSERT INTO survey_360_assignments (
  evaluated_user_id,
  evaluating_user_id,
  diagnostic_stage_id,
  assignment_type,
  status
) VALUES (
  '7c04b872-6de2-418d-b959-616894d398d7',
  '7c04b872-6de2-418d-b959-616894d398d7',
  '2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36',
  'self',
  'approved'
)
ON CONFLICT DO NOTHING;

-- Step 4: Create missing manager assignment for Yurasova in the current stage
-- Manager is 4cf40061-4c6f-4379-8082-5bb2ddd8a5ef
INSERT INTO survey_360_assignments (
  evaluated_user_id,
  evaluating_user_id,
  diagnostic_stage_id,
  assignment_type,
  is_manager_participant,
  status
) VALUES (
  '7c04b872-6de2-418d-b959-616894d398d7',
  '4cf40061-4c6f-4379-8082-5bb2ddd8a5ef',
  '2192c6ba-01ec-4cc4-b9e3-27ee3ab5da36',
  'manager',
  true,
  'approved'
)
ON CONFLICT DO NOTHING;
