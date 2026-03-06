
CREATE OR REPLACE FUNCTION public.get_evaluated_user_grade_id(
  p_user_id UUID,
  p_assignment_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_grade_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM survey_360_assignments
    WHERE id = p_assignment_id
      AND evaluating_user_id = auth.uid()
      AND evaluated_user_id = p_user_id
      AND status IN ('approved', 'pending', 'completed')
  ) THEN
    RAISE EXCEPTION 'No active assignment found';
  END IF;

  SELECT grade_id INTO v_grade_id
  FROM users WHERE id = p_user_id;

  RETURN v_grade_id;
END;
$$;
