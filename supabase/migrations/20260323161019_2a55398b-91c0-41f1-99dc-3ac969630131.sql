
-- Table for tracking admin bulk snapshot runs
CREATE TABLE public.diagnostic_snapshot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.diagnostic_stages(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  started_by uuid NOT NULL REFERENCES auth.users(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  total_subjects integer NOT NULL DEFAULT 0,
  processed_subjects integer NOT NULL DEFAULT 0,
  progress_percent numeric NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  versioned_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  summary_json jsonb,
  error_message text
);

-- Prevent parallel runs for same stage
CREATE UNIQUE INDEX idx_snapshot_runs_one_active_per_stage
  ON public.diagnostic_snapshot_runs (stage_id)
  WHERE status = 'running';

-- RLS
ALTER TABLE public.diagnostic_snapshot_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_admin_select_snapshot_runs"
  ON public.diagnostic_snapshot_runs FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'system.admin'));

CREATE POLICY "system_admin_insert_snapshot_runs"
  ON public.diagnostic_snapshot_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'system.admin'));

CREATE POLICY "system_admin_update_snapshot_runs"
  ON public.diagnostic_snapshot_runs FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'system.admin'))
  WITH CHECK (public.has_permission(auth.uid(), 'system.admin'));
