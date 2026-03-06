-- Aggregate existing data directly without calling trigger functions
DO $$
DECLARE
  user_rec RECORD;
BEGIN
  -- Aggregate survey_360_results for each evaluated user
  FOR user_rec IN 
    SELECT DISTINCT evaluated_user_id
    FROM survey_360_results
  LOOP
    -- Delete existing aggregated results for this user
    DELETE FROM user_assessment_results
    WHERE user_id = user_rec.evaluated_user_id;
    
    -- Insert aggregated quality results
    INSERT INTO user_assessment_results (
      user_id,
      diagnostic_stage_id,
      assessment_period,
      assessment_date,
      quality_id,
      self_assessment,
      peers_average,
      manager_assessment,
      total_responses
    )
    SELECT 
      user_rec.evaluated_user_id,
      (SELECT ds.id FROM diagnostic_stages ds
       JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
       WHERE dsp.user_id = user_rec.evaluated_user_id AND ds.is_active = true
       LIMIT 1),
      get_evaluation_period(NOW()),
      NOW(),
      sq.quality_id,
      AVG(CASE WHEN sr.evaluating_user_id = user_rec.evaluated_user_id THEN ao.value ELSE NULL END),
      AVG(CASE 
        WHEN sr.evaluating_user_id != user_rec.evaluated_user_id 
          AND sr.evaluating_user_id != (SELECT manager_id FROM users WHERE id = user_rec.evaluated_user_id)
        THEN ao.value 
        ELSE NULL 
      END),
      AVG(CASE WHEN sr.evaluating_user_id = (SELECT manager_id FROM users WHERE id = user_rec.evaluated_user_id) THEN ao.value ELSE NULL END),
      COUNT(*)
    FROM survey_360_results sr
    JOIN survey_360_questions sq ON sr.question_id = sq.id
    JOIN survey_360_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.evaluated_user_id = user_rec.evaluated_user_id
      AND sq.quality_id IS NOT NULL
    GROUP BY sq.quality_id;
  END LOOP;
  
  -- Aggregate skill_survey_results for each user
  FOR user_rec IN 
    SELECT DISTINCT user_id
    FROM skill_survey_results
  LOOP
    -- Insert aggregated skill results
    INSERT INTO user_assessment_results (
      user_id,
      diagnostic_stage_id,
      assessment_period,
      assessment_date,
      skill_id,
      self_assessment,
      peers_average,
      manager_assessment,
      total_responses
    )
    SELECT 
      user_rec.user_id,
      (SELECT ds.id FROM diagnostic_stages ds
       JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
       WHERE dsp.user_id = user_rec.user_id AND ds.is_active = true
       LIMIT 1),
      get_evaluation_period(NOW()),
      NOW(),
      ssq.skill_id,
      AVG(CASE WHEN sr.evaluating_user_id = user_rec.user_id THEN ao.step ELSE NULL END),
      AVG(CASE 
        WHEN sr.evaluating_user_id != user_rec.user_id 
          AND sr.evaluating_user_id != (SELECT manager_id FROM users WHERE id = user_rec.user_id)
        THEN ao.step 
        ELSE NULL 
      END),
      AVG(CASE WHEN sr.evaluating_user_id = (SELECT manager_id FROM users WHERE id = user_rec.user_id) THEN ao.step ELSE NULL END),
      COUNT(*)
    FROM skill_survey_results sr
    JOIN skill_survey_questions ssq ON sr.question_id = ssq.id
    JOIN skill_survey_answer_options ao ON sr.answer_option_id = ao.id
    WHERE sr.user_id = user_rec.user_id
      AND ssq.skill_id IS NOT NULL
    GROUP BY ssq.skill_id;
  END LOOP;
END $$;