-- Add new fields to diagnostic_stages table
ALTER TABLE diagnostic_stages 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'setup',
ADD COLUMN IF NOT EXISTS progress_percent numeric DEFAULT 0;

-- Update created_by to be NOT NULL if it's currently nullable
ALTER TABLE diagnostic_stages 
ALTER COLUMN created_by SET NOT NULL;

-- Create function to calculate diagnostic stage progress
CREATE OR REPLACE FUNCTION calculate_diagnostic_stage_progress(stage_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_participants integer;
  completed_skill_surveys integer;
  completed_360_surveys integer;
  total_required integer;
  completed_total integer;
  progress numeric;
BEGIN
  -- Count total participants
  SELECT COUNT(*) INTO total_participants
  FROM diagnostic_stage_participants
  WHERE stage_id = stage_id_param;
  
  -- If no participants, return 0
  IF total_participants = 0 THEN
    RETURN 0;
  END IF;
  
  -- Each participant needs to complete both skill survey and 360 survey
  total_required := total_participants * 2;
  
  -- Count completed skill surveys for participants
  SELECT COUNT(DISTINCT ssr.user_id) INTO completed_skill_surveys
  FROM skill_survey_results ssr
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = ssr.user_id
  WHERE dsp.stage_id = stage_id_param;
  
  -- Count completed 360 surveys for participants
  SELECT COUNT(DISTINCT s360r.evaluated_user_id) INTO completed_360_surveys
  FROM survey_360_results s360r
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = s360r.evaluated_user_id
  WHERE dsp.stage_id = stage_id_param;
  
  -- Total completed
  completed_total := completed_skill_surveys + completed_360_surveys;
  
  -- Calculate progress percentage
  progress := (completed_total::numeric / total_required::numeric) * 100;
  
  RETURN ROUND(progress, 2);
END;
$$;

-- Create function to update diagnostic stage status and progress
CREATE OR REPLACE FUNCTION update_diagnostic_stage_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  new_progress numeric;
  new_status text;
BEGIN
  -- Find the active stage for this participant
  SELECT ds.* INTO stage_record
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = COALESCE(NEW.user_id, NEW.evaluated_user_id)
    AND ds.is_active = true
  LIMIT 1;
  
  IF stage_record.id IS NOT NULL THEN
    -- Calculate new progress
    new_progress := calculate_diagnostic_stage_progress(stage_record.id);
    
    -- Determine new status
    IF new_progress = 0 THEN
      new_status := 'setup';
    ELSIF new_progress >= 100 THEN
      new_status := 'completed';
    ELSE
      new_status := 'assessment';
    END IF;
    
    -- Update the stage
    UPDATE diagnostic_stages
    SET progress_percent = new_progress,
        status = new_status,
        updated_at = now()
    WHERE id = stage_record.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers to update progress when surveys are completed
DROP TRIGGER IF EXISTS update_diagnostic_progress_on_skill_survey ON skill_survey_results;
CREATE TRIGGER update_diagnostic_progress_on_skill_survey
AFTER INSERT ON skill_survey_results
FOR EACH ROW
EXECUTE FUNCTION update_diagnostic_stage_status();

DROP TRIGGER IF EXISTS update_diagnostic_progress_on_360_survey ON survey_360_results;
CREATE TRIGGER update_diagnostic_progress_on_360_survey
AFTER INSERT ON survey_360_results
FOR EACH ROW
EXECUTE FUNCTION update_diagnostic_stage_status();

-- Create trigger to update progress when participants are added
DROP TRIGGER IF EXISTS update_diagnostic_progress_on_participant ON diagnostic_stage_participants;
CREATE TRIGGER update_diagnostic_progress_on_participant
AFTER INSERT ON diagnostic_stage_participants
FOR EACH ROW
EXECUTE FUNCTION update_diagnostic_stage_status();