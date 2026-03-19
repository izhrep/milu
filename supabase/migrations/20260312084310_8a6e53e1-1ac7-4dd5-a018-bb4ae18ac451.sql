
-- 1. Add is_anonymous column
ALTER TABLE open_question_results ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;

-- 2. Drop old SELECT policy and create restricted one
DROP POLICY IF EXISTS "Participants and admins can view results" ON open_question_results;

CREATE POLICY "Evaluator and admins can view results"
  ON open_question_results FOR SELECT TO authenticated
  USING (
    evaluating_user_id = auth.uid()
    OR public.has_permission(auth.uid(), 'diagnostics.manage')
  );

-- 3. Create safe RPC for evaluated users
CREATE OR REPLACE FUNCTION public.get_open_question_results_safe(
  p_evaluated_user_id uuid,
  p_stage_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  open_question_id uuid,
  assignment_id uuid,
  diagnostic_stage_id uuid,
  evaluating_user_id uuid,
  evaluated_user_id uuid,
  answer_text text,
  is_draft boolean,
  is_anonymous boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oqr.id,
    oqr.open_question_id,
    oqr.assignment_id,
    oqr.diagnostic_stage_id,
    CASE
      WHEN oqr.is_anonymous = true AND auth.uid() = oqr.evaluated_user_id
      THEN NULL
      ELSE oqr.evaluating_user_id
    END AS evaluating_user_id,
    oqr.evaluated_user_id,
    oqr.answer_text,
    oqr.is_draft,
    oqr.is_anonymous,
    oqr.created_at,
    oqr.updated_at
  FROM open_question_results oqr
  WHERE oqr.evaluated_user_id = p_evaluated_user_id
    AND oqr.is_draft = false
    AND (p_stage_id IS NULL OR oqr.diagnostic_stage_id = p_stage_id);
END;
$$;
