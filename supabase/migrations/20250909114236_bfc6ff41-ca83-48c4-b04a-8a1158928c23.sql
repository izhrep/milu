-- Fix security issues by setting search_path for functions
CREATE OR REPLACE FUNCTION update_user_qualities_from_survey()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Insert or update user_qualities based on survey results
    INSERT INTO user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at)
    SELECT 
        NEW.evaluated_user_id,
        sq.quality_id,
        ao.value,
        ao.value + 1, -- target level is current + 1
        NEW.created_at
    FROM survey_360_questions sq
    JOIN survey_360_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE sq.id = NEW.question_id 
      AND sq.quality_id IS NOT NULL
    ON CONFLICT (user_id, quality_id) 
    DO UPDATE SET 
        current_level = (
            SELECT AVG(ao.value)
            FROM survey_360_results sr
            JOIN survey_360_answer_options ao ON ao.id = sr.answer_option_id
            JOIN survey_360_questions sq ON sq.id = sr.question_id
            WHERE sr.evaluated_user_id = NEW.evaluated_user_id 
              AND sq.quality_id = user_qualities.quality_id
        ),
        last_assessed_at = NEW.created_at,
        updated_at = now();
    
    RETURN NEW;
END;
$$;

-- Fix security issues by setting search_path for functions
CREATE OR REPLACE FUNCTION update_user_skills_from_survey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Insert or update user_skills based on skill survey results
    INSERT INTO user_skills (user_id, skill_id, current_level, target_level, last_assessed_at)
    SELECT 
        NEW.user_id,
        ssq.skill_id,
        ao.step,
        ao.step + 1, -- target level is current + 1
        NEW.created_at
    FROM skill_survey_questions ssq
    JOIN skill_survey_answer_options ao ON ao.id = NEW.answer_option_id
    WHERE ssq.id = NEW.question_id 
      AND ssq.skill_id IS NOT NULL
    ON CONFLICT (user_id, skill_id) 
    DO UPDATE SET 
        current_level = (
            SELECT AVG(ao.step)
            FROM skill_survey_results sr
            JOIN skill_survey_answer_options ao ON ao.id = sr.answer_option_id
            JOIN skill_survey_questions ssq ON ssq.id = sr.question_id
            WHERE sr.user_id = NEW.user_id 
              AND ssq.skill_id = user_skills.skill_id
        ),
        last_assessed_at = NEW.created_at,
        updated_at = now();
    
    RETURN NEW;
END;
$$;