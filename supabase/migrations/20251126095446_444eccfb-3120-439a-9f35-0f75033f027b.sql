-- Обновление триггеров агрегации для корректной обработки peer-оценок
-- Peer-оценки должны включать ВСЕ оценки коллег (evaluating_user_id) с is_draft=false
-- НЕЗАВИСИМО от структуры подчинённости

-- Обновленная функция агрегации для hard skills
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
  
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id AND skill_id IS NOT NULL;
  
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, skill_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, stage_id, get_evaluation_period(NOW()), NOW(), hq.skill_id,
    -- Самооценка: только оценки, где evaluating = evaluated
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    -- Оценка руководителя: только оценки от manager_id
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    -- Peer-оценки: ВСЕ остальные оценки с is_draft=false (без фильтрации по структуре подчинённости)
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
  GROUP BY hq.skill_id;
  
  RETURN NEW;
END;
$function$;

-- Обновленная функция агрегации для soft skills
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
  
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND diagnostic_stage_id = stage_id AND quality_id IS NOT NULL;
  
  INSERT INTO user_assessment_results (
    user_id, diagnostic_stage_id, assessment_period, assessment_date, quality_id,
    self_assessment, manager_assessment, peers_average, total_responses
  )
  SELECT 
    NEW.evaluated_user_id, stage_id, get_evaluation_period(NOW()), NOW(), sq.quality_id,
    -- Самооценка: только оценки, где evaluating = evaluated
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.numeric_value ELSE NULL END),
    -- Оценка руководителя: только оценки от manager_id
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.numeric_value ELSE NULL END),
    -- Peer-оценки: ВСЕ остальные оценки с is_draft=false (без фильтрации по структуре подчинённости)
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
  GROUP BY sq.quality_id;
  
  RETURN NEW;
END;
$function$;