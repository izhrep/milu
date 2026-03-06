-- Fix RLS policies for survey_360_assignments to allow peer assignment creation
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "survey_360_assignments_insert_auth_policy" ON survey_360_assignments;

-- Create new INSERT policy that allows users to create peer assignments
CREATE POLICY "survey_360_assignments_insert_auth_policy" 
ON survey_360_assignments FOR INSERT 
TO authenticated
WITH CHECK (
  -- Пользователь может создавать assignments для самооценки
  (evaluated_user_id = auth.uid() AND evaluating_user_id = auth.uid())
  OR
  -- Пользователь может создавать peer assignments для себя (где он evaluated_user)
  (evaluated_user_id = auth.uid() AND assignment_type = 'peer')
  OR
  -- Руководитель может создавать manager assignments для своих подчиненных
  (assignment_type = 'manager' AND is_users_manager(auth.uid(), evaluated_user_id))
  OR
  -- Пользователи с правами могут создавать любые assignments
  has_permission('diagnostics.manage')
);