-- Function to update user qualities based on survey 360 results
CREATE OR REPLACE FUNCTION update_user_qualities_from_survey()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for survey_360_results
CREATE TRIGGER update_user_qualities_trigger
    AFTER INSERT ON survey_360_results
    FOR EACH ROW
    EXECUTE FUNCTION update_user_qualities_from_survey();

-- Function to update user skills based on skill survey results  
CREATE OR REPLACE FUNCTION update_user_skills_from_survey()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for skill_survey_results
CREATE TRIGGER update_user_skills_trigger
    AFTER INSERT ON skill_survey_results
    FOR EACH ROW
    EXECUTE FUNCTION update_user_skills_from_survey();

-- Manually update existing data for Владимир Маршаков
INSERT INTO user_qualities (user_id, quality_id, current_level, target_level, last_assessed_at)
SELECT 
    '550e8400-e29b-41d4-a716-446655440000'::uuid as user_id,
    sq.quality_id,
    AVG(ao.value) as current_level,
    AVG(ao.value) + 1 as target_level,
    MAX(sr.created_at) as last_assessed_at
FROM survey_360_results sr
JOIN survey_360_questions sq ON sr.question_id = sq.id
JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
WHERE sr.evaluated_user_id = '550e8400-e29b-41d4-a716-446655440000'
  AND sq.quality_id IS NOT NULL
GROUP BY sq.quality_id
ON CONFLICT (user_id, quality_id) 
DO UPDATE SET 
    current_level = EXCLUDED.current_level,
    target_level = EXCLUDED.target_level,
    last_assessed_at = EXCLUDED.last_assessed_at,
    updated_at = now();