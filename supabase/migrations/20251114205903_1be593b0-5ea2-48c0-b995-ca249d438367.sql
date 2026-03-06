-- Drop existing SELECT policy
DROP POLICY IF EXISTS "survey_360_assignments_select_auth_policy" ON survey_360_assignments;

-- Create new SELECT policy that allows:
-- 1. Users to see their own assignments (as evaluator or evaluated)
-- 2. Managers to see assignments for their subordinates
-- 3. HR BP and Admins to see all assignments
CREATE POLICY "survey_360_assignments_select_auth_policy"
ON survey_360_assignments
FOR SELECT
USING (
  evaluated_user_id = auth.uid()
  OR evaluating_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = survey_360_assignments.evaluated_user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "survey_360_assignments_update_auth_policy" ON survey_360_assignments;

-- Create new UPDATE policy
CREATE POLICY "survey_360_assignments_update_auth_policy"
ON survey_360_assignments
FOR UPDATE
USING (
  evaluating_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = survey_360_assignments.evaluated_user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);