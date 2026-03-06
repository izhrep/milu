-- =============================================
-- PHASE 2: PROTECTING COMMENT ANONYMITY
-- =============================================
-- Problem: evaluating_user_id is visible even when is_anonymous_comment = true
-- Solution: Create views that mask evaluator identity for anonymous feedback

-- Function to get hard skill results with anonymity protection
CREATE OR REPLACE FUNCTION get_hard_skill_results_safe(
  p_evaluated_user_id uuid,
  p_stage_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  question_id uuid,
  answer_option_id uuid,
  evaluated_user_id uuid,
  evaluating_user_id uuid,
  diagnostic_stage_id uuid,
  assignment_id uuid,
  comment text,
  is_anonymous_comment boolean,
  is_draft boolean,
  is_skip boolean,
  evaluation_period text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hsr.id,
    hsr.question_id,
    hsr.answer_option_id,
    hsr.evaluated_user_id,
    -- Mask evaluating_user_id if:
    -- 1. Comment is anonymous AND
    -- 2. Current user is the evaluated user (they shouldn't see who gave anonymous feedback)
    CASE 
      WHEN hsr.is_anonymous_comment = true AND auth.uid() = hsr.evaluated_user_id 
      THEN NULL 
      ELSE hsr.evaluating_user_id 
    END as evaluating_user_id,
    hsr.diagnostic_stage_id,
    hsr.assignment_id,
    hsr.comment,
    hsr.is_anonymous_comment,
    hsr.is_draft,
    hsr.is_skip,
    hsr.evaluation_period,
    hsr.created_at,
    hsr.updated_at
  FROM hard_skill_results hsr
  WHERE hsr.evaluated_user_id = p_evaluated_user_id
    AND (p_stage_id IS NULL OR hsr.diagnostic_stage_id = p_stage_id)
    AND hsr.is_draft = false;
END;
$$;

-- Function to get soft skill results with anonymity protection
CREATE OR REPLACE FUNCTION get_soft_skill_results_safe(
  p_evaluated_user_id uuid,
  p_stage_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  question_id uuid,
  answer_option_id uuid,
  evaluated_user_id uuid,
  evaluating_user_id uuid,
  diagnostic_stage_id uuid,
  assignment_id uuid,
  comment text,
  is_anonymous_comment boolean,
  is_draft boolean,
  is_skip boolean,
  evaluation_period text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ssr.id,
    ssr.question_id,
    ssr.answer_option_id,
    ssr.evaluated_user_id,
    -- Mask evaluating_user_id for anonymous feedback when viewed by evaluated user
    CASE 
      WHEN ssr.is_anonymous_comment = true AND auth.uid() = ssr.evaluated_user_id 
      THEN NULL 
      ELSE ssr.evaluating_user_id 
    END as evaluating_user_id,
    ssr.diagnostic_stage_id,
    ssr.assignment_id,
    ssr.comment,
    ssr.is_anonymous_comment,
    ssr.is_draft,
    ssr.is_skip,
    ssr.evaluation_period,
    ssr.created_at,
    ssr.updated_at
  FROM soft_skill_results ssr
  WHERE ssr.evaluated_user_id = p_evaluated_user_id
    AND (p_stage_id IS NULL OR ssr.diagnostic_stage_id = p_stage_id)
    AND ssr.is_draft = false;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_hard_skill_results_safe(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_soft_skill_results_safe(uuid, uuid) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION get_hard_skill_results_safe IS 'Returns hard skill results with evaluator anonymity protection. When is_anonymous_comment=true, the evaluated user cannot see evaluating_user_id.';
COMMENT ON FUNCTION get_soft_skill_results_safe IS 'Returns soft skill results with evaluator anonymity protection. When is_anonymous_comment=true, the evaluated user cannot see evaluating_user_id.';