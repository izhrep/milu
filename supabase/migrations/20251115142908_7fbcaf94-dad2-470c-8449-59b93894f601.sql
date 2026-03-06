-- Fix infinite recursion in users table RLS policies
-- Drop problematic recursive policies
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "HR BP can view company users" ON users;
DROP POLICY IF EXISTS "Users can view same department colleagues for 360" ON users;

-- Create non-recursive SELECT policies
-- 1. Users can view their own profile
CREATE POLICY "users_can_view_own_profile" 
ON users FOR SELECT 
TO authenticated
USING (id = auth.uid());

-- 2. Admins can view all users (using can_view_users function)
CREATE POLICY "admins_can_view_all_users" 
ON users FOR SELECT 
TO authenticated
USING (can_view_users(auth.uid()));

-- 3. Managers can view their direct reports (using simple user_roles check)
CREATE POLICY "managers_can_view_subordinates" 
ON users FOR SELECT 
TO authenticated
USING (
  manager_id = auth.uid()
);

-- 4. Users with view permission can see all active users
CREATE POLICY "users_with_permission_can_view" 
ON users FOR SELECT 
TO authenticated
USING (
  status = true 
  AND EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'hr_bp', 'manager')
  )
);