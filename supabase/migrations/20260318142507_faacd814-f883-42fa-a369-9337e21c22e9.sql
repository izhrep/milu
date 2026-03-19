CREATE POLICY "meeting_decisions_delete_auth_policy"
  ON public.meeting_decisions
  FOR DELETE
  TO authenticated
  USING (
    is_meeting_participant(meeting_id, auth.uid())
    OR has_permission('meetings.manage'::text)
  );