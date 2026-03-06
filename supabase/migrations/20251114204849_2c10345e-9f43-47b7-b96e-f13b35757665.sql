-- Update RLS policies for soft_skill_results to allow HR BP and managers to view team results

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "soft_skill_results_select_auth_policy" ON soft_skill_results;

-- Create new SELECT policy with proper permissions
CREATE POLICY "soft_skill_results_select_auth_policy"
ON soft_skill_results
FOR SELECT
TO public
USING (
  -- Own results (as evaluated or evaluator)
  evaluated_user_id = auth.uid() 
  OR evaluating_user_id = auth.uid()
  -- Admin and HR BP can view all
  OR has_permission('diagnostics.view_all'::text)
  -- Managers can view their team's results
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = soft_skill_results.evaluated_user_id 
    AND users.manager_id = auth.uid()
  )
);

-- Update RLS policies for hard_skill_results to allow HR BP and managers to view team results

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "hard_skill_results_select_auth_policy" ON hard_skill_results;

-- Create new SELECT policy with proper permissions
CREATE POLICY "hard_skill_results_select_auth_policy"
ON hard_skill_results
FOR SELECT
TO public
USING (
  -- Own results (as evaluated or evaluator)
  evaluated_user_id = auth.uid() 
  OR evaluating_user_id = auth.uid()
  -- Admin and HR BP can view all
  OR has_permission('diagnostics.view_all'::text)
  -- Managers can view their team's results
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = hard_skill_results.evaluated_user_id 
    AND users.manager_id = auth.uid()
  )
);

COMMENT ON POLICY "soft_skill_results_select_auth_policy" ON soft_skill_results IS 
'Users can view their own results, HR BP and admins can view all, managers can view team results';

COMMENT ON POLICY "hard_skill_results_select_auth_policy" ON hard_skill_results IS 
'Users can view their own results, HR BP and admins can view all, managers can view team results';