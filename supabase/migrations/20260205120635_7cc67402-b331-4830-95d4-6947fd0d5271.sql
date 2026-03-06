-- ==============================================
-- 1. Удаляем проблемные уникальные индексы
-- ==============================================
DROP INDEX IF EXISTS idx_user_assessment_quality_period;
DROP INDEX IF EXISTS idx_user_assessment_skill_period;

-- ==============================================
-- 2. Создаём stage-scoped уникальные индексы
-- ==============================================
CREATE UNIQUE INDEX idx_user_assessment_quality_stage_period 
ON user_assessment_results (user_id, quality_id, diagnostic_stage_id, assessment_period) 
WHERE quality_id IS NOT NULL AND diagnostic_stage_id IS NOT NULL;

CREATE UNIQUE INDEX idx_user_assessment_skill_stage_period 
ON user_assessment_results (user_id, skill_id, diagnostic_stage_id, assessment_period) 
WHERE skill_id IS NOT NULL AND diagnostic_stage_id IS NOT NULL;

-- ==============================================
-- 3. Обновляем триггер soft skills с UPSERT
-- ==============================================
CREATE OR REPLACE FUNCTION public.aggregate_soft_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  stage_id := NEW.diagnostic_stage_id;
  IF stage_id IS NULL THEN RETURN NEW; END IF;
  
  SELECT u.manager_id INTO manager_id FROM users u WHERE u.id = NEW.evaluated_user_id;
  
  -- UPSERT вместо DELETE + INSERT
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, quality_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, 
    stage_id, 
    get_evaluation_period(NOW()), 
    NOW(), 
    sq.quality_id,
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value ELSE NULL 
    END),
    COUNT(*)
  FROM soft_skill_results sr
  JOIN soft_skill_questions sq ON sr.question_id = sq.id
  JOIN soft_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND sq.quality_id IS NOT NULL
  GROUP BY sq.quality_id
  ON CONFLICT (user_id, quality_id, diagnostic_stage_id, assessment_period) 
  WHERE quality_id IS NOT NULL AND diagnostic_stage_id IS NOT NULL
  DO UPDATE SET
    self_assessment = EXCLUDED.self_assessment,
    manager_assessment = EXCLUDED.manager_assessment,
    peers_average = EXCLUDED.peers_average,
    total_responses = EXCLUDED.total_responses,
    assessment_date = EXCLUDED.assessment_date,
    updated_at = NOW();
  
  RETURN NEW;
END;
$function$;

-- ==============================================
-- 4. Обновляем триггер hard skills с UPSERT
-- ==============================================
CREATE OR REPLACE FUNCTION public.aggregate_hard_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_id UUID;
  manager_id UUID;
BEGIN
  stage_id := NEW.diagnostic_stage_id;
  IF stage_id IS NULL THEN RETURN NEW; END IF;
  
  SELECT u.manager_id INTO manager_id FROM users u WHERE u.id = NEW.evaluated_user_id;
  
  -- UPSERT вместо DELETE + INSERT
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, skill_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, 
    stage_id, 
    get_evaluation_period(NOW()), 
    NOW(), 
    hq.skill_id,
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND (manager_id IS NULL OR sr.evaluating_user_id != manager_id)
      THEN ao.numeric_value ELSE NULL 
    END),
    COUNT(*)
  FROM hard_skill_results sr
  JOIN hard_skill_questions hq ON sr.question_id = hq.id
  JOIN hard_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sr.diagnostic_stage_id = stage_id
    AND sr.is_draft = false
    AND hq.skill_id IS NOT NULL
  GROUP BY hq.skill_id
  ON CONFLICT (user_id, skill_id, diagnostic_stage_id, assessment_period) 
  WHERE skill_id IS NOT NULL AND diagnostic_stage_id IS NOT NULL
  DO UPDATE SET
    self_assessment = EXCLUDED.self_assessment,
    manager_assessment = EXCLUDED.manager_assessment,
    peers_average = EXCLUDED.peers_average,
    total_responses = EXCLUDED.total_responses,
    assessment_date = EXCLUDED.assessment_date,
    updated_at = NOW();
  
  RETURN NEW;
END;
$function$;