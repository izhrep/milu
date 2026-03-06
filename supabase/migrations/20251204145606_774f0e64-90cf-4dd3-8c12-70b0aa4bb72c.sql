-- Drop existing policies on role_permissions if any
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can view role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_select_policy" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_insert_policy" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_delete_policy" ON public.role_permissions;

-- Create policies for role_permissions table

-- SELECT: Allow authenticated users to view role_permissions
CREATE POLICY "role_permissions_select_policy" 
ON public.role_permissions 
FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Only users with security.manage permission can add role permissions
CREATE POLICY "role_permissions_insert_policy" 
ON public.role_permissions 
FOR INSERT 
TO authenticated 
WITH CHECK (
  public.has_permission(auth.uid(), 'security.manage')
);

-- DELETE: Only users with security.manage permission can remove role permissions
CREATE POLICY "role_permissions_delete_policy" 
ON public.role_permissions 
FOR DELETE 
TO authenticated 
USING (
  public.has_permission(auth.uid(), 'security.manage')
);