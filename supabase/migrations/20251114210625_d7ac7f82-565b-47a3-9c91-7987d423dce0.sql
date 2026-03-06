-- Drop existing SELECT policy on user_assessment_results if exists
DROP POLICY IF EXISTS "user_assessment_results_select_auth_policy" ON user_assessment_results;

-- Create new SELECT policy allowing:
-- 1. Users to see their own results
-- 2. Managers to see their subordinates' results
-- 3. HR BP and Admins to see all results
CREATE POLICY "user_assessment_results_select_auth_policy"
ON user_assessment_results
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = user_assessment_results.user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);