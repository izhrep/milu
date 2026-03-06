-- Обновляем функции и триггеры для использования новых названий таблиц

-- 1. Обновляем функцию update_user_qualities_from_survey
DROP FUNCTION IF EXISTS public.update_user_qualities_from_survey() CASCADE;
CREATE OR REPLACE FUNCTION public.update_user_qualities_from_survey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at)
    SELECT 
        NEW.evaluated_user_id,
        sq.quality_id,
        ao.value,
        ao.value + 1,
        NEW.created_at
    FROM soft_skill_questions sq
    JOIN soft_skill_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE sq.id = NEW.question_id 
      AND sq.quality_id IS NOT NULL
    ON CONFLICT (user_id, quality_id) 
    DO UPDATE SET 
        current_level = (
            SELECT AVG(ao.value)
            FROM soft_skill_results sr
            JOIN soft_skill_answer_options ao ON ao.id = sr.answer_option_id
            JOIN soft_skill_questions sq ON sq.id = sr.question_id
            WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
              AND sq.quality_id = user_qualities.quality_id
        ),
        last_assessed_at = NEW.created_at,
        updated_at = now();
    
    RETURN NEW;
END;
$function$;

-- 2. Обновляем функцию update_user_skills_from_survey
DROP FUNCTION IF EXISTS public.update_user_skills_from_survey() CASCADE;
CREATE OR REPLACE FUNCTION public.update_user_skills_from_survey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO user_skills (user_id, skill_id, current_level, target_level, last_assessed_at)
    SELECT 
        NEW.user_id,
        ssq.skill_id,
        ao.step,
        ao.step + 1,
        NEW.created_at
    FROM hard_skill_questions ssq
    JOIN hard_skill_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE ssq.id = NEW.question_id 
      AND ssq.skill_id IS NOT NULL
    ON CONFLICT (user_id, skill_id) 
    DO UPDATE SET 
        current_level = (
            SELECT AVG(ao.step)
            FROM hard_skill_results sr
            JOIN hard_skill_answer_options ao ON ao.id = sr.answer_option_id
            JOIN hard_skill_questions ssq ON ssq.id = sr.question_id
            WHERE sr.user_id = NEW.user_id 
              AND ssq.skill_id = user_skills.skill_id
        ),
        last_assessed_at = NEW.created_at,
        updated_at = now();
    
    RETURN NEW;
END;
$function$;

-- 3. Обновляем функцию update_diagnostic_stage_status
DROP FUNCTION IF EXISTS public.update_diagnostic_stage_status() CASCADE;
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
    target_user_id := NEW.user_id;
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

-- 4. Обновляем функцию calculate_diagnostic_stage_progress
DROP FUNCTION IF EXISTS public.calculate_diagnostic_stage_progress(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.calculate_diagnostic_stage_progress(stage_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  FROM hard_skill_results ssr
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = ssr.user_id
  WHERE dsp.stage_id = stage_id_param;
  
  SELECT COUNT(DISTINCT s360r.evaluated_user_id) INTO completed_360_surveys
  FROM soft_skill_results s360r
  JOIN diagnostic_stage_participants dsp ON dsp.user_id = s360r.evaluated_user_id
  WHERE dsp.stage_id = stage_id_param;
  
  completed_total := completed_skill_surveys + completed_360_surveys;
  progress := (completed_total::numeric / total_required::numeric) * 100;
  
  RETURN ROUND(progress, 2);
END;
$function$;

-- 5. Обновляем функцию complete_diagnostic_task_on_surveys_completion
DROP FUNCTION IF EXISTS public.complete_diagnostic_task_on_surveys_completion() CASCADE;
CREATE OR REPLACE FUNCTION public.complete_diagnostic_task_on_surveys_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id uuid;
  has_hard_skill_survey boolean;
  has_soft_skill_survey boolean;
BEGIN
  IF TG_TABLE_NAME = 'hard_skill_results' THEN
    target_user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'soft_skill_results' THEN
    target_user_id := NEW.evaluated_user_id;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM hard_skill_results 
    WHERE user_id = target_user_id
    LIMIT 1
  ) INTO has_hard_skill_survey;
  
  SELECT EXISTS (
    SELECT 1 FROM soft_skill_results 
    WHERE evaluated_user_id = target_user_id
    LIMIT 1
  ) INTO has_soft_skill_survey;
  
  IF has_hard_skill_survey AND has_soft_skill_survey THEN
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

-- 6. Пересоздаём триггеры
DROP TRIGGER IF EXISTS update_user_qualities_trigger ON soft_skill_results;
CREATE TRIGGER update_user_qualities_trigger
    AFTER INSERT ON soft_skill_results
    FOR EACH ROW
    EXECUTE FUNCTION update_user_qualities_from_survey();

DROP TRIGGER IF EXISTS update_user_skills_trigger ON hard_skill_results;
CREATE TRIGGER update_user_skills_trigger
    AFTER INSERT ON hard_skill_results
    FOR EACH ROW
    EXECUTE FUNCTION update_user_skills_from_survey();

DROP TRIGGER IF EXISTS update_stage_on_hard_skill_result ON hard_skill_results;
CREATE TRIGGER update_stage_on_hard_skill_result
    AFTER INSERT ON hard_skill_results
    FOR EACH ROW
    EXECUTE FUNCTION update_diagnostic_stage_status();

DROP TRIGGER IF EXISTS update_stage_on_soft_skill_result ON soft_skill_results;
CREATE TRIGGER update_stage_on_soft_skill_result
    AFTER INSERT ON soft_skill_results
    FOR EACH ROW
    EXECUTE FUNCTION update_diagnostic_stage_status();

DROP TRIGGER IF EXISTS complete_task_on_hard_skill_result ON hard_skill_results;
CREATE TRIGGER complete_task_on_hard_skill_result
    AFTER INSERT ON hard_skill_results
    FOR EACH ROW
    EXECUTE FUNCTION complete_diagnostic_task_on_surveys_completion();

DROP TRIGGER IF EXISTS complete_task_on_soft_skill_result ON soft_skill_results;
CREATE TRIGGER complete_task_on_soft_skill_result
    AFTER INSERT ON soft_skill_results
    FOR EACH ROW
    EXECUTE FUNCTION complete_diagnostic_task_on_surveys_completion();