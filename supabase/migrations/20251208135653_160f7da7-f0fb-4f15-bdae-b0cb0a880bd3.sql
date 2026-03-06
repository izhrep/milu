-- Create function to auto-deactivate parent stages based on deadline
CREATE OR REPLACE FUNCTION public.check_and_deactivate_expired_stages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deactivate parent stages where deadline_date has passed
  UPDATE parent_stages
  SET is_active = false, updated_at = now()
  WHERE is_active = true 
    AND deadline_date < CURRENT_DATE;
    
  -- Also deactivate diagnostic stages linked to expired parent stages
  UPDATE diagnostic_stages
  SET is_active = false, updated_at = now()
  WHERE is_active = true
    AND parent_id IN (
      SELECT id FROM parent_stages WHERE is_active = false
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_and_deactivate_expired_stages() TO authenticated;

-- Create a helper function to get stage active status based on deadline
CREATE OR REPLACE FUNCTION public.is_stage_expired(deadline_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT deadline_date < CURRENT_DATE;
$$;