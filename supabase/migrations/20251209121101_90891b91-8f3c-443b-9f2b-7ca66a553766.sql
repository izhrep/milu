
-- Fix trigger to use grade-based target_level instead of numeric_value + 1
CREATE OR REPLACE FUNCTION public.update_user_qualities_from_survey()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_grade_id UUID;
  v_target_level NUMERIC;
BEGIN
  -- Обновляем только при is_draft = false
  IF NEW.is_draft = false THEN
    -- Получаем grade_id пользователя
    SELECT grade_id INTO v_grade_id
    FROM users
    WHERE id = NEW.evaluated_user_id;
    
    -- Получаем target_level из grade_qualities
    SELECT gq.target_level INTO v_target_level
    FROM soft_skill_questions sq
    JOIN grade_qualities gq ON gq.quality_id = sq.quality_id AND gq.grade_id = v_grade_id
    WHERE sq.id = NEW.question_id
      AND sq.quality_id IS NOT NULL;
    
    INSERT INTO user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at)
    SELECT 
      NEW.evaluated_user_id,
      sq.quality_id,
      ao.numeric_value,
      COALESCE(v_target_level, 5), -- Use grade target or default to max (5)
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
      target_level = COALESCE(v_target_level, user_qualities.target_level),
      last_assessed_at = NEW.created_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update existing user_qualities to use correct target_level from grade_qualities
UPDATE user_qualities
SET target_level = subq.grade_target,
    updated_at = now()
FROM (
  SELECT uq.id as uq_id, gq.target_level as grade_target
  FROM user_qualities uq
  JOIN users u ON u.id = uq.user_id
  JOIN grade_qualities gq ON gq.grade_id = u.grade_id AND gq.quality_id = uq.quality_id
  WHERE gq.target_level IS NOT NULL
) subq
WHERE user_qualities.id = subq.uq_id;
