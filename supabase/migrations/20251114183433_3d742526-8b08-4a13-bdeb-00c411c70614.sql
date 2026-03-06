-- Drop the problematic policy
DROP POLICY IF EXISTS "HR BP can view users from their company" ON users;

-- Add a simpler RLS policy for hr_bp to view users from their company
CREATE POLICY "HR BP can view company users"
ON users
FOR SELECT
TO authenticated
USING (
  -- User is hr_bp and viewing users from same company
  EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    JOIN departments d1 ON d1.id = u.department_id
    JOIN departments d2 ON d2.company_id = d1.company_id
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'hr_bp'
    AND d2.id = users.department_id
  )
);