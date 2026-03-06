-- Add RLS policy for hr_bp to view users from their company
CREATE POLICY "HR BP can view users from their company"
ON users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'hr_bp'
    AND EXISTS (
      SELECT 1 FROM users cu
      JOIN users cu2 ON cu2.department_id IN (
        SELECT d1.id FROM departments d1
        WHERE d1.company_id = (
          SELECT d2.company_id FROM departments d2
          WHERE d2.id = cu.department_id
        )
      )
      WHERE cu.id = auth.uid()
      AND cu2.id = users.id
    )
  )
);