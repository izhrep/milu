-- ============================================================================
-- FIX log_diagnostic_stage_changes FUNCTION
-- ============================================================================
-- Replace full_name with email since full_name column doesn't exist
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_diagnostic_stage_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO admin_activity_logs (
      user_id,
      user_name,
      action,
      entity_type,
      entity_name,
      details
    )
    SELECT 
      NEW.created_by,
      u.email,
      'CREATE',
      'diagnostic_stage',
      NEW.period,
      jsonb_build_object(
        'stage_id', NEW.id,
        'period', NEW.period,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date
      )
    FROM users u
    WHERE u.id = NEW.created_by;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO admin_activity_logs (
      user_id,
      user_name,
      action,
      entity_type,
      entity_name,
      details
    )
    VALUES (
      get_current_session_user(),
      (SELECT email FROM users WHERE id = get_current_session_user()),
      'UPDATE',
      'diagnostic_stage',
      NEW.period,
      jsonb_build_object(
        'stage_id', NEW.id,
        'field', 'status',
        'old_value', OLD.status,
        'new_value', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- ENSURE TRIGGER EXISTS
-- ============================================================================

DROP TRIGGER IF EXISTS log_diagnostic_stage_changes_trigger ON diagnostic_stages;

CREATE TRIGGER log_diagnostic_stage_changes_trigger
AFTER INSERT OR UPDATE ON diagnostic_stages
FOR EACH ROW
EXECUTE FUNCTION log_diagnostic_stage_changes();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- ✅ Function uses email instead of full_name
-- ✅ Trigger is properly attached to diagnostic_stages table
-- ============================================================================