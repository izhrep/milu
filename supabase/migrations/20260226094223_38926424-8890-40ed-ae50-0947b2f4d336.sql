ALTER TABLE meeting_artifacts
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_stage_id uuid DEFAULT NULL;