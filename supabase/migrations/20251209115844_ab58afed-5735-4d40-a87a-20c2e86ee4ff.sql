
-- Fix user_qualities constraints for Soft Skills (0-5)
ALTER TABLE user_qualities DROP CONSTRAINT IF EXISTS user_qualities_current_level_check;
ALTER TABLE user_qualities ADD CONSTRAINT user_qualities_current_level_check CHECK (current_level >= 0 AND current_level <= 5);

ALTER TABLE user_qualities DROP CONSTRAINT IF EXISTS user_qualities_target_level_check;
ALTER TABLE user_qualities ADD CONSTRAINT user_qualities_target_level_check CHECK (target_level >= 0 AND target_level <= 5);

-- Fix update_user_qualities_from_survey to cap target_level at max scale
CREATE OR REPLACE FUNCTION public.update_user_qualities_from_survey()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Обновляем только при is_draft = false
  IF NEW.is_draft = false THEN
    INSERT INTO user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at)
    SELECT 
      NEW.evaluated_user_id,
      sq.quality_id,
      ao.numeric_value,
      LEAST(ao.numeric_value + 1, 5), -- Cap at max soft skill level
      NEW.created_at
    FROM soft_skill_questions sq
    JOIN soft_skill_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE sq.id = NEW.question_id 
      AND sq.quality_id IS NOT NULL
    ON CONFLICT (user_id, quality_id) 
    DO UPDATE SET 
      current_level = (
        SELECT AVG(ao.numeric_value)
        FROM soft_skill_results sr
        JOIN soft_skill_answer_options ao ON ao.id = sr.answer_option_id
        JOIN soft_skill_questions sq ON sq.id = sr.question_id
        WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
          AND sq.quality_id = user_qualities.quality_id
          AND sr.is_draft = false
      ),
      last_assessed_at = NEW.created_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Also fix update_user_skills_from_survey to cap at 4
CREATE OR REPLACE FUNCTION public.update_user_skills_from_survey()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Обновляем только при is_draft = false
  IF NEW.is_draft = false THEN
    INSERT INTO user_skills (user_id, skill_id, current_level, target_level, last_assessed_at)
    SELECT 
      NEW.evaluated_user_id,
      hq.skill_id,
      ao.numeric_value,
      LEAST(ao.numeric_value + 1, 4), -- Cap at max hard skill level
      NEW.created_at
    FROM hard_skill_questions hq
    JOIN hard_skill_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE hq.id = NEW.question_id 
      AND hq.skill_id IS NOT NULL
    ON CONFLICT (user_id, skill_id) 
    DO UPDATE SET 
      current_level = (
        SELECT AVG(ao.numeric_value)
        FROM hard_skill_results sr
        JOIN hard_skill_answer_options ao ON ao.id = sr.answer_option_id
        JOIN hard_skill_questions hq ON hq.id = sr.question_id
        WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
          AND hq.skill_id = user_skills.skill_id
          AND sr.is_draft = false
      ),
      last_assessed_at = NEW.created_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;
