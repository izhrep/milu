-- Drop the problematic policy
DROP POLICY IF EXISTS "HR BP can view company users" ON users;

-- Create a security definer function to get company departments for hr_bp
CREATE OR REPLACE FUNCTION public.get_hr_bp_company_department_ids(_user_id uuid)
RETURNS TABLE(department_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d2.id 
  FROM user_roles ur
  JOIN users u ON u.id = ur.user_id
  JOIN departments d1 ON d1.id = u.department_id
  JOIN departments d2 ON d2.company_id = d1.company_id
  WHERE ur.user_id = _user_id
    AND ur.role = 'hr_bp';
$$;

-- Add RLS policy using the function to avoid recursion
CREATE POLICY "HR BP can view company users"
ON users
FOR SELECT
TO authenticated
USING (
  department_id IN (
    SELECT department_id 
    FROM get_hr_bp_company_department_ids(auth.uid())
  )
);