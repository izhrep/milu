-- Allow admins to view permissions
CREATE POLICY "Admins can view permissions"
ON public.permissions
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to view role_permissions
CREATE POLICY "Admins can view role_permissions"
ON public.role_permissions
FOR SELECT
USING (has_role(auth.uid(), 'admin'));