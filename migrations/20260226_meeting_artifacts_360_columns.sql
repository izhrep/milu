-- Add source_type and source_stage_id columns to meeting_artifacts
-- for distinguishing auto-generated 360 snapshots from manual uploads
ALTER TABLE meeting_artifacts
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_stage_id uuid DEFAULT NULL;
