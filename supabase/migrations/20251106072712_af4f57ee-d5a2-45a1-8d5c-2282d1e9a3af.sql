-- Update RLS policy for survey_360_assignments to allow managers to update
DROP POLICY IF EXISTS "Users can update their 360 assignments" ON survey_360_assignments;

CREATE POLICY "Users can update their 360 assignments" 
ON survey_360_assignments
FOR UPDATE 
USING (
  (evaluated_user_id = get_current_session_user()) 
  OR (evaluating_user_id = get_current_session_user())
  OR is_current_user_admin()
  OR is_manager_of_user(evaluated_user_id)
);