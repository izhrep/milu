-- Update RLS policies for survey_360_assignments to allow managers and HR BP to view and manage team respondents

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "survey_360_assignments_select_auth_policy" ON survey_360_assignments;

-- Create new SELECT policy with proper permissions for managers
CREATE POLICY "survey_360_assignments_select_auth_policy"
ON survey_360_assignments
FOR SELECT
TO public
USING (
  -- Own assignments (as evaluated or evaluator)
  evaluated_user_id = auth.uid() 
  OR evaluating_user_id = auth.uid()
  -- Admin and HR BP can view all
  OR has_permission('diagnostics.view_all'::text)
  -- Managers can view their team's assignments
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = survey_360_assignments.evaluated_user_id 
    AND users.manager_id = auth.uid()
  )
);

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "survey_360_assignments_update_auth_policy" ON survey_360_assignments;

-- Create new UPDATE policy with proper permissions for managers
CREATE POLICY "survey_360_assignments_update_auth_policy"
ON survey_360_assignments
FOR UPDATE
TO public
USING (
  -- Own assignments
  evaluated_user_id = auth.uid() 
  -- Admin and HR BP can manage all
  OR has_permission('diagnostics.manage'::text)
  -- Managers can manage their team's assignments (approve/reject respondents)
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = survey_360_assignments.evaluated_user_id 
    AND users.manager_id = auth.uid()
  )
);

COMMENT ON POLICY "survey_360_assignments_select_auth_policy" ON survey_360_assignments IS 
'Users can view their own assignments, HR BP and admins can view all, managers can view team assignments';

COMMENT ON POLICY "survey_360_assignments_update_auth_policy" ON survey_360_assignments IS 
'Users can update their own assignments, HR BP and admins can manage all, managers can approve/reject team respondents';