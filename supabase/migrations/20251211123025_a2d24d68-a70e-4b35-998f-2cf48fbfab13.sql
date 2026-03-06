-- Add RLS policy for HR/admin to insert hard_skill_results (for offline import)
CREATE POLICY "hr_admin_can_insert_hard_skill_results"
ON public.hard_skill_results
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_effective_permissions
    WHERE user_id = auth.uid()
    AND permission_name IN ('diagnostics.manage', 'security.manage')
  )
);

-- Add RLS policy for HR/admin to insert soft_skill_results (for offline import)
CREATE POLICY "hr_admin_can_insert_soft_skill_results"
ON public.soft_skill_results
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_effective_permissions
    WHERE user_id = auth.uid()
    AND permission_name IN ('diagnostics.manage', 'security.manage')
  )
);