-- Удаляем существующую политику DELETE
DROP POLICY IF EXISTS "survey_360_assignments_delete_policy" ON survey_360_assignments;

-- Создаём новую политику DELETE
CREATE POLICY "survey_360_assignments_delete_policy" 
ON survey_360_assignments 
FOR DELETE 
USING (
  -- Только свои pending peer assignments
  (
    evaluated_user_id = auth.uid() 
    AND assignment_type = 'peer'
    AND status = 'pending'
  )
  OR
  -- Админы могут удалять всё
  (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  ))
);