
-- ============================================================
-- Meeting historicity: RLS SELECT updates + storage hardening
-- ============================================================

-- 1) one_on_one_meetings SELECT: add is_users_manager(employee_id)
DROP POLICY IF EXISTS "one_on_one_meetings_select_auth_policy" ON one_on_one_meetings;
CREATE POLICY "one_on_one_meetings_select_auth_policy"
ON one_on_one_meetings FOR SELECT TO authenticated
USING (
  employee_id = auth.uid()
  OR manager_id = auth.uid()
  OR is_users_manager(employee_id)
  OR has_permission('meetings.view_all')
);

-- 2) meeting_decisions SELECT: add current-manager access via employee_id
DROP POLICY IF EXISTS "meeting_decisions_select_auth_policy" ON meeting_decisions;
CREATE POLICY "meeting_decisions_select_auth_policy"
ON meeting_decisions FOR SELECT TO authenticated
USING (
  is_meeting_participant(meeting_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM one_on_one_meetings m
    WHERE m.id = meeting_decisions.meeting_id
      AND is_users_manager(m.employee_id)
  )
  OR has_permission('meetings.view_all')
);

-- 3) meeting_artifacts SELECT: add current-manager access via employee_id
DROP POLICY IF EXISTS "meeting_artifacts_select" ON meeting_artifacts;
CREATE POLICY "meeting_artifacts_select" ON meeting_artifacts
FOR SELECT TO authenticated
USING (
  is_meeting_participant(meeting_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM one_on_one_meetings m
    WHERE m.id = meeting_artifacts.meeting_id
      AND is_users_manager(m.employee_id)
  )
  OR has_permission('meetings.view_all')
);

-- 4) Storage DELETE hardening: only uploader or meetings.manage
DROP POLICY IF EXISTS "meeting_artifacts_storage_delete" ON storage.objects;
CREATE POLICY "meeting_artifacts_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'meeting-artifacts'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT ma.meeting_id::text FROM meeting_artifacts ma
      WHERE ma.uploaded_by = auth.uid()
        AND ma.storage_path = name
        AND ma.is_deleted = false
    )
    OR has_permission('meetings.manage')
  )
);
