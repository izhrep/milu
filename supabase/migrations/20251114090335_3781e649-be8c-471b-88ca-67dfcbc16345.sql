-- Fix infinite recursion in users table RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view all user records" ON public.users;

-- Create a simple policy that doesn't cause recursion
-- Users can view their own record, or if they have effective permission
CREATE POLICY "Users can view user records"
ON public.users
FOR SELECT
USING (
  -- User can see their own record
  auth.uid() = id
  OR
  -- Or user has view_users permission (direct check without recursion)
  EXISTS (
    SELECT 1 FROM public.user_effective_permissions uep
    WHERE uep.user_id = auth.uid()
    AND uep.permission_name = 'view_users'
  )
);