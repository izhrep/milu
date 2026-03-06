-- Fix INSERT policy for survey_360_assignments to allow managers to add approved peer assignments
DROP POLICY IF EXISTS "survey_360_assignments_insert_policy" ON survey_360_assignments;

CREATE POLICY "survey_360_assignments_insert_policy" 
ON survey_360_assignments 
FOR INSERT 
WITH CHECK (
  -- Сотрудник создает pending peer assignments для себя
  (
    evaluated_user_id = auth.uid() 
    AND assignment_type = 'peer'
    AND status = 'pending'
  )
  OR
  -- Руководитель может создавать approved peer assignments для своих подчинённых
  (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = survey_360_assignments.evaluated_user_id 
      AND users.manager_id = auth.uid()
    )
    AND assignment_type = 'peer'
    AND status = 'approved'
    AND added_by_manager = true
    AND approved_by = auth.uid()
  )
  OR
  -- Админы и HR могут создавать любые assignments
  (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'hr_bp')
  ))
);