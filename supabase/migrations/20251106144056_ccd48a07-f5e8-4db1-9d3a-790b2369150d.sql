-- Исправление функции update_diagnostic_stage_status
-- Проблема: для hard_skill_results использовалось NEW.user_id, но поле называется evaluated_user_id

CREATE OR REPLACE FUNCTION public.update_diagnostic_stage_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_record RECORD;
  new_progress numeric;
  new_status text;
  target_user_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'hard_skill_results' THEN
    target_user_id := NEW.evaluated_user_id;  -- ИСПРАВЛЕНО: было NEW.user_id
  ELSIF TG_TABLE_NAME = 'soft_skill_results' THEN
    target_user_id := NEW.evaluated_user_id;
  ELSIF TG_TABLE_NAME = 'diagnostic_stage_participants' THEN
    target_user_id := NEW.user_id;
  ELSE
    RETURN NEW;
  END IF;

  SELECT ds.* INTO stage_record
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = target_user_id
    AND ds.is_active = true
  LIMIT 1;
  
  IF stage_record.id IS NOT NULL THEN
    new_progress := calculate_diagnostic_stage_progress(stage_record.id);
    
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
    WHERE id = stage_record.id;
  END IF;
  
  RETURN NEW;
END;
$function$;