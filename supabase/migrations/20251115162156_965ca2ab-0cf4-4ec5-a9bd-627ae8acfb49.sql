-- Fix infinite recursion in users_can_view_department_colleagues policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "users_can_view_department_colleagues" ON users;

-- Create security definer function to get user's department_id without RLS
CREATE OR REPLACE FUNCTION get_user_department_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id
  FROM users
  WHERE id = _user_id
$$;

-- Create non-recursive policy for viewing department colleagues
CREATE POLICY "users_can_view_department_colleagues" 
ON users FOR SELECT 
TO authenticated
USING (
  status = true 
  AND department_id = get_user_department_id(auth.uid())
  AND department_id IS NOT NULL
);