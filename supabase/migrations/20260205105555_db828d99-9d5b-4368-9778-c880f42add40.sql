-- Create johari_ai_snapshots table for storing AI-generated Johari Window reports
CREATE TABLE public.johari_ai_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.diagnostic_stages(id) ON DELETE CASCADE,
  evaluated_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  
  metrics_json JSONB NOT NULL,   -- Calculated metrics per skill
  ai_text TEXT,                  -- AI response (summary + recommendations)
  data_hash TEXT NOT NULL,       -- SHA256 for change detection
  
  prompt_version TEXT,           -- Prompt version (semver)
  model TEXT,                    -- AI model used (google/gemini-2.5-flash)
  
  UNIQUE (stage_id, evaluated_user_id, version)
);

-- Create indexes for efficient querying
CREATE INDEX idx_johari_snapshots_stage_user ON public.johari_ai_snapshots(stage_id, evaluated_user_id);
CREATE INDEX idx_johari_snapshots_evaluated_user ON public.johari_ai_snapshots(evaluated_user_id);

-- Enable Row Level Security
ALTER TABLE public.johari_ai_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy: HR/Admin can view all snapshots via permission
CREATE POLICY "HR and admin can view all snapshots"
ON public.johari_ai_snapshots FOR SELECT
TO authenticated
USING (
  public.has_permission('assessment_results.view_all')
);

-- RLS Policy: Managers can view snapshots of their direct reports
CREATE POLICY "Managers can view their team snapshots"
ON public.johari_ai_snapshots FOR SELECT
TO authenticated
USING (
  evaluated_user_id IN (
    SELECT id FROM public.users WHERE manager_id = auth.uid()
  )
);

-- RLS Policy: HR/Admin can insert snapshots via permission
CREATE POLICY "HR and admin can insert snapshots"
ON public.johari_ai_snapshots FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission('assessment_results.view_all')
);

-- RLS Policy: Managers can insert snapshots for their direct reports
CREATE POLICY "Managers can insert snapshots for their team"
ON public.johari_ai_snapshots FOR INSERT
TO authenticated
WITH CHECK (
  evaluated_user_id IN (
    SELECT id FROM public.users WHERE manager_id = auth.uid()
  )
);

-- Comment on table
COMMENT ON TABLE public.johari_ai_snapshots IS 'Stores historical AI-generated Johari Window reports per diagnostic stage and evaluated user';