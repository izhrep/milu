-- Drop both policies to start fresh
DROP POLICY IF EXISTS "HR BP can view users from their company" ON users;
DROP POLICY IF EXISTS "HR BP can view company users" ON users;

-- Add a simpler RLS policy for hr_bp without recursion
CREATE POLICY "HR BP can view company users"
ON users
FOR SELECT
TO authenticated
USING (
  -- User is hr_bp and viewing users from same company
  department_id IN (
    SELECT d2.id 
    FROM user_roles ur
    JOIN departments d1 ON d1.id = (SELECT department_id FROM users WHERE id = ur.user_id)
    JOIN departments d2 ON d2.company_id = d1.company_id
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'hr_bp'
  )
);