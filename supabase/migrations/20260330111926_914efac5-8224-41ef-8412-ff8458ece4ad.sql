CREATE POLICY "No direct client access"
ON public.meeting_notifications
FOR ALL
TO public
USING (false)
WITH CHECK (false);