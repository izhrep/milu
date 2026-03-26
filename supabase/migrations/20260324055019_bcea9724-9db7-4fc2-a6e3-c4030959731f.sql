CREATE POLICY "one_on_one_meetings_delete_policy"
ON public.one_on_one_meetings
FOR DELETE
TO authenticated
USING (has_permission('meetings.delete'::text));