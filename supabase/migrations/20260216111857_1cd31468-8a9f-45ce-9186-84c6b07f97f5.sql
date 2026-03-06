-- Add respondent_scope column to johari_ai_snapshots
ALTER TABLE public.johari_ai_snapshots 
  ADD COLUMN respondent_scope TEXT NOT NULL DEFAULT 'all';

-- Add CHECK constraint
ALTER TABLE public.johari_ai_snapshots 
  ADD CONSTRAINT johari_ai_snapshots_respondent_scope_check 
  CHECK (respondent_scope IN ('all', 'external_only'));

-- Drop old unique constraint and create new one with scope
ALTER TABLE public.johari_ai_snapshots 
  DROP CONSTRAINT IF EXISTS johari_ai_snapshots_stage_id_evaluated_user_id_version_key;

ALTER TABLE public.johari_ai_snapshots 
  ADD CONSTRAINT johari_ai_snapshots_stage_user_scope_version_key 
  UNIQUE (stage_id, evaluated_user_id, respondent_scope, version);

-- Update index
DROP INDEX IF EXISTS idx_johari_snapshots_stage_user;
CREATE INDEX idx_johari_snapshots_stage_user_scope 
  ON public.johari_ai_snapshots(stage_id, evaluated_user_id, respondent_scope);