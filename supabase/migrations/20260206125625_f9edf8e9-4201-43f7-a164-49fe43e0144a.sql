-- ==================================
-- FIX: Infinite recursion in users RLS policy
-- ==================================

-- 1. Create SECURITY DEFINER function to get user's manager_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_current_user_manager_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT manager_id FROM public.users WHERE id = auth.uid();
$$;

-- 2. Drop the problematic policy
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

-- 3. Create fixed policy that avoids self-referencing query
CREATE POLICY "users_select_policy"
ON public.users
FOR SELECT TO authenticated
USING (
    -- User can see themselves
    id = auth.uid()
    -- Admin/HR can see all
    OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'hr_bp')
    )
    -- Users with specific permissions can see all
    OR EXISTS (
        SELECT 1 FROM public.user_effective_permissions uep
        WHERE uep.user_id = auth.uid()
        AND uep.permission_name IN ('users.view', 'users.view_all', 'security.manage_users')
    )
    -- Managers can see their subordinates
    OR manager_id = auth.uid()
    -- Users can see their own manager (using SECURITY DEFINER function)
    OR id = public.get_current_user_manager_id()
);