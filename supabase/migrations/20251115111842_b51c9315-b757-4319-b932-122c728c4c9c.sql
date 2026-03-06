-- RLS политики для access_denied_logs (только админы могут просматривать)
CREATE POLICY "access_denied_logs_select_admin"
ON public.access_denied_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "access_denied_logs_insert_system"
ON public.access_denied_logs FOR INSERT TO authenticated
WITH CHECK (true);