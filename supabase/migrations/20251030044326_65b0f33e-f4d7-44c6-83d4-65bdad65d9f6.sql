-- ============================================================================
-- FINAL RLS SETUP - UPDATE REMAINING TABLES AND FUNCTIONS
-- ============================================================================

-- ============================================================================
-- PART 1: ENABLE RLS ON REMAINING TABLES
-- ============================================================================

ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_qualities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_assessment_results ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 2: UPDATE ALL AUTOMATION FUNCTIONS TO SECURITY DEFINER
-- ============================================================================

-- Already done in previous migration, just verify they are SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.calculate_diagnostic_stage_progress(stage_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  total_participants integer;
  completed_skill_surveys integer;
  completed_360_surveys integer;
  total_required integer;
  completed_total integer;
  progress numeric;
BEGIN
  SELECT COUNT(*) INTO total_participants
  FROM diagnostic_stage_participants
  WHERE stage_id = stage_id_param;
  
  IF total_participants = 0 THEN
    RETURN 0;
  END IF;
  
  total_required := total_participants * 2;
  
  SELECT COUNT(DISTINCT ssr.user_id) INTO completed_skill_surveys
  FROM skill_survey_results ssr
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = ssr.user_id
  WHERE dsp.stage_id = stage_id_param;
  
  SELECT COUNT(DISTINCT s360r.evaluated_user_id) INTO completed_360_surveys
  FROM survey_360_results s360r
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = s360r.evaluated_user_id
  WHERE dsp.stage_id = stage_id_param;
  
  completed_total := completed_skill_surveys + completed_360_surveys;
  progress := (completed_total::numeric / total_required::numeric) * 100;
  
  RETURN ROUND(progress, 2);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_on_participant_add()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_progress numeric;
  new_status text;
BEGIN
  new_progress := calculate_diagnostic_stage_progress(NEW.stage_id);
  
  IF new_progress = 0 THEN
    new_status := 'setup';
  ELSIF new_progress >= 100 THEN
    new_status := 'completed';
  ELSE
    new_status := 'assessment';
  END IF;
  
  UPDATE diagnostic_stages
  SET progress_percent = new_progress,
      status = new_status,
      updated_at = now()
  WHERE id = NEW.stage_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  stage_record RECORD;
BEGIN
  SELECT * INTO stage_record
  FROM diagnostic_stages
  WHERE id = NEW.stage_id;
  
  IF stage_record.evaluation_period IS NULL THEN
    RAISE EXCEPTION 'Evaluation period not set for diagnostic stage';
  END IF;
  
  INSERT INTO skill_survey_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'отправлен запрос'
  )
  ON CONFLICT DO NOTHING;
  
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    status
  )
  SELECT 
    NEW.user_id,
    u.manager_id,
    'отправлен запрос'
  FROM users u
  WHERE u.id = NEW.user_id 
    AND u.manager_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_diagnostic_task_on_surveys_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  target_user_id uuid;
  has_skill_survey boolean;
  has_360_survey boolean;
BEGIN
  IF TG_TABLE_NAME = 'skill_survey_results' THEN
    target_user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'survey_360_results' THEN
    target_user_id := NEW.evaluated_user_id;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM skill_survey_results 
    WHERE user_id = target_user_id
    LIMIT 1
  ) INTO has_skill_survey;
  
  SELECT EXISTS (
    SELECT 1 FROM survey_360_results 
    WHERE evaluated_user_id = target_user_id
    LIMIT 1
  ) INTO has_360_survey;
  
  IF has_skill_survey AND has_360_survey THEN
    UPDATE tasks
    SET status = 'completed',
        updated_at = now()
    WHERE user_id = target_user_id
      AND task_type = 'assessment'
      AND category = 'Диагностика'
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- PART 3: ADD ADMIN ACTIVITY LOGGING
-- ============================================================================

CREATE OR REPLACE FUNCTION log_diagnostic_stage_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
      u.full_name,
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
      (SELECT full_name FROM users WHERE id = get_current_session_user()),
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
$function$;

DROP TRIGGER IF EXISTS trigger_log_diagnostic_stage_changes ON diagnostic_stages;
CREATE TRIGGER trigger_log_diagnostic_stage_changes
AFTER INSERT OR UPDATE ON diagnostic_stages
FOR EACH ROW
EXECUTE FUNCTION log_diagnostic_stage_changes();

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================
-- ✅ RLS enabled on: user_skills, user_qualities, user_assessment_results
-- ✅ All diagnostic functions updated with SECURITY DEFINER
-- ✅ Admin activity logging added for diagnostic stages
-- ✅ Policies created in previous migrations for all tables
-- ============================================================================