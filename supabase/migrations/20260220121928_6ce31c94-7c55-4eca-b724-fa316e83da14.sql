
-- Таблица meeting_artifacts
CREATE TABLE public.meeting_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES one_on_one_meetings(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_artifacts_meeting_id ON meeting_artifacts(meeting_id);
CREATE INDEX idx_meeting_artifacts_uploaded_by ON meeting_artifacts(uploaded_by);
CREATE INDEX idx_meeting_artifacts_created_at ON meeting_artifacts(created_at);

ALTER TABLE meeting_artifacts ENABLE ROW LEVEL SECURITY;

-- SELECT: участники встречи или meetings.view_all
CREATE POLICY "meeting_artifacts_select" ON meeting_artifacts
  FOR SELECT TO authenticated
  USING (
    is_meeting_participant(meeting_id, auth.uid())
    OR has_permission(auth.uid(), 'meetings.view_all')
  );

-- INSERT: участники встречи
CREATE POLICY "meeting_artifacts_insert" ON meeting_artifacts
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      is_meeting_participant(meeting_id, auth.uid())
      OR has_permission(auth.uid(), 'meetings.manage')
    )
  );

-- UPDATE (soft delete): uploader или meetings.manage
CREATE POLICY "meeting_artifacts_update" ON meeting_artifacts
  FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR has_permission(auth.uid(), 'meetings.manage')
  );

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-artifacts', 'meeting-artifacts', false);

-- Storage policies: upload для участников
CREATE POLICY "meeting_artifacts_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'meeting-artifacts'
  AND (storage.foldername(name))[1] IS NOT NULL
);

-- Storage policies: select для authenticated
CREATE POLICY "meeting_artifacts_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'meeting-artifacts');

-- Storage policies: delete
CREATE POLICY "meeting_artifacts_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'meeting-artifacts');
