-- Update hard_skill_results SELECT policy
DROP POLICY IF EXISTS "hard_skill_results_select_auth_policy" ON hard_skill_results;

CREATE POLICY "hard_skill_results_select_auth_policy"
ON hard_skill_results
FOR SELECT
USING (
  evaluated_user_id = auth.uid()
  OR evaluating_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = hard_skill_results.evaluated_user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);

-- Update soft_skill_results SELECT policy
DROP POLICY IF EXISTS "soft_skill_results_select_auth_policy" ON soft_skill_results;

CREATE POLICY "soft_skill_results_select_auth_policy"
ON soft_skill_results
FOR SELECT
USING (
  evaluated_user_id = auth.uid()
  OR evaluating_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = soft_skill_results.evaluated_user_id
    AND users.manager_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr_bp')
  )
);