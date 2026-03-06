-- Переименование таблиц диагностики для унификации модели данных

-- 1. Переименовываем таблицы survey_360 в soft_skill
ALTER TABLE public.survey_360_questions RENAME TO soft_skill_questions;
ALTER TABLE public.survey_360_answer_options RENAME TO soft_skill_answer_options;
ALTER TABLE public.survey_360_results RENAME TO soft_skill_results;

-- 2. Переименовываем таблицы skill_survey в hard_skill
ALTER TABLE public.skill_survey_questions RENAME TO hard_skill_questions;
ALTER TABLE public.skill_survey_answer_options RENAME TO hard_skill_answer_options;
ALTER TABLE public.skill_survey_results RENAME TO hard_skill_results;

-- 3. Переименовываем индексы для soft_skill_questions
ALTER INDEX IF EXISTS survey_360_questions_pkey RENAME TO soft_skill_questions_pkey;
ALTER INDEX IF EXISTS idx_survey_360_questions_quality RENAME TO idx_soft_skill_questions_quality;
ALTER INDEX IF EXISTS idx_survey_360_questions_order RENAME TO idx_soft_skill_questions_order;

-- 4. Переименовываем индексы для soft_skill_answer_options
ALTER INDEX IF EXISTS survey_360_answer_options_pkey RENAME TO soft_skill_answer_options_pkey;
ALTER INDEX IF EXISTS idx_survey_360_answer_options_value RENAME TO idx_soft_skill_answer_options_value;

-- 5. Переименовываем индексы для soft_skill_results
ALTER INDEX IF EXISTS survey_360_results_pkey RENAME TO soft_skill_results_pkey;
ALTER INDEX IF EXISTS idx_survey_360_results_evaluated RENAME TO idx_soft_skill_results_evaluated;
ALTER INDEX IF EXISTS idx_survey_360_results_evaluating RENAME TO idx_soft_skill_results_evaluating;
ALTER INDEX IF EXISTS idx_survey_360_results_question RENAME TO idx_soft_skill_results_question;
ALTER INDEX IF EXISTS idx_survey_360_results_period RENAME TO idx_soft_skill_results_period;

-- 6. Переименовываем индексы для hard_skill_questions
ALTER INDEX IF EXISTS skill_survey_questions_pkey RENAME TO hard_skill_questions_pkey;
ALTER INDEX IF EXISTS idx_skill_survey_questions_skill RENAME TO idx_hard_skill_questions_skill;
ALTER INDEX IF EXISTS idx_skill_survey_questions_order RENAME TO idx_hard_skill_questions_order;

-- 7. Переименовываем индексы для hard_skill_answer_options
ALTER INDEX IF EXISTS skill_survey_answer_options_pkey RENAME TO hard_skill_answer_options_pkey;
ALTER INDEX IF EXISTS idx_skill_survey_answer_options_step RENAME TO idx_hard_skill_answer_options_step;

-- 8. Переименовываем индексы для hard_skill_results
ALTER INDEX IF EXISTS skill_survey_results_pkey RENAME TO hard_skill_results_pkey;
ALTER INDEX IF EXISTS idx_skill_survey_results_user RENAME TO idx_hard_skill_results_user;
ALTER INDEX IF EXISTS idx_skill_survey_results_question RENAME TO idx_hard_skill_results_question;
ALTER INDEX IF EXISTS idx_skill_survey_results_period RENAME TO idx_hard_skill_results_period;

-- 9. Переименовываем constraints для soft_skill
ALTER TABLE public.soft_skill_questions RENAME CONSTRAINT survey_360_questions_quality_id_fkey TO soft_skill_questions_quality_id_fkey;
ALTER TABLE public.soft_skill_results RENAME CONSTRAINT survey_360_results_answer_option_id_fkey TO soft_skill_results_answer_option_id_fkey;
ALTER TABLE public.soft_skill_results RENAME CONSTRAINT survey_360_results_evaluated_user_id_fkey TO soft_skill_results_evaluated_user_id_fkey;
ALTER TABLE public.soft_skill_results RENAME CONSTRAINT survey_360_results_evaluating_user_id_fkey TO soft_skill_results_evaluating_user_id_fkey;
ALTER TABLE public.soft_skill_results RENAME CONSTRAINT survey_360_results_question_id_fkey TO soft_skill_results_question_id_fkey;

-- 10. Переименовываем constraints для hard_skill
ALTER TABLE public.hard_skill_questions RENAME CONSTRAINT skill_survey_questions_skill_id_fkey TO hard_skill_questions_skill_id_fkey;
ALTER TABLE public.hard_skill_results RENAME CONSTRAINT skill_survey_results_answer_option_id_fkey TO hard_skill_results_answer_option_id_fkey;
ALTER TABLE public.hard_skill_results RENAME CONSTRAINT skill_survey_results_question_id_fkey TO hard_skill_results_question_id_fkey;
ALTER TABLE public.hard_skill_results RENAME CONSTRAINT skill_survey_results_user_id_fkey TO hard_skill_results_user_id_fkey;
ALTER TABLE public.hard_skill_results RENAME CONSTRAINT skill_survey_results_evaluating_user_id_fkey TO hard_skill_results_evaluating_user_id_fkey;

-- 11. Обновляем функцию агрегации результатов soft skills (survey_360)
CREATE OR REPLACE FUNCTION public.aggregate_soft_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.evaluated_user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.evaluated_user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.evaluated_user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by quality and evaluator type
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
    NEW.evaluated_user_id,
    stage_id,
    eval_period,
    NOW(),
    sq.quality_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.evaluated_user_id THEN ao.value ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.evaluated_user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.value 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.value ELSE NULL END),
    COUNT(*)
  FROM soft_skill_results sr
  JOIN soft_skill_questions sq ON sr.question_id = sq.id
  JOIN soft_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.evaluated_user_id = NEW.evaluated_user_id
    AND sq.quality_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY sq.quality_id;
  
  RETURN NEW;
END;
$function$;

-- 12. Обновляем функцию агрегации результатов hard skills (skill_survey)
CREATE OR REPLACE FUNCTION public.aggregate_hard_skill_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  eval_period TEXT;
  stage_id UUID;
  manager_id UUID;
BEGIN
  -- Get evaluation period
  eval_period := get_evaluation_period(NEW.created_at);
  
  -- Get diagnostic stage if exists
  SELECT ds.id INTO stage_id
  FROM diagnostic_stages ds
  JOIN diagnostic_stage_participants dsp ON dsp.stage_id = ds.id
  WHERE dsp.user_id = NEW.user_id
    AND ds.is_active = true
  LIMIT 1;
  
  -- Get manager ID
  SELECT u.manager_id INTO manager_id
  FROM users u
  WHERE u.id = NEW.user_id;
  
  -- Delete existing aggregated results for this period and stage
  DELETE FROM user_assessment_results
  WHERE user_id = NEW.user_id
    AND assessment_period = eval_period
    AND (diagnostic_stage_id = stage_id OR (diagnostic_stage_id IS NULL AND stage_id IS NULL));
  
  -- Aggregate results by skill and evaluator type
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
    NEW.user_id,
    stage_id,
    eval_period,
    NOW(),
    ssq.skill_id,
    -- Self assessment
    AVG(CASE WHEN sr.evaluating_user_id = NEW.user_id THEN ao.step ELSE NULL END),
    -- Peers average (not self, not manager)
    AVG(CASE 
      WHEN sr.evaluating_user_id != NEW.user_id 
        AND sr.evaluating_user_id != manager_id 
      THEN ao.step 
      ELSE NULL 
    END),
    -- Manager assessment
    AVG(CASE WHEN sr.evaluating_user_id = manager_id THEN ao.step ELSE NULL END),
    COUNT(*)
  FROM hard_skill_results sr
  JOIN hard_skill_questions ssq ON sr.question_id = ssq.id
  JOIN hard_skill_answer_options ao ON sr.answer_option_id = ao.id
  WHERE sr.user_id = NEW.user_id
    AND ssq.skill_id IS NOT NULL
    AND sr.evaluation_period = eval_period
  GROUP BY ssq.skill_id;
  
  RETURN NEW;
END;
$function$;

-- 13. Удаляем старые триггеры
DROP TRIGGER IF EXISTS aggregate_survey_360_results_trigger ON public.soft_skill_results;
DROP TRIGGER IF EXISTS aggregate_skill_survey_results_trigger ON public.hard_skill_results;
DROP TRIGGER IF EXISTS complete_diagnostic_task_soft_skills ON public.soft_skill_results;
DROP TRIGGER IF EXISTS complete_diagnostic_task_hard_skills ON public.hard_skill_results;
DROP TRIGGER IF EXISTS update_diagnostic_stage_on_soft_skill_result ON public.soft_skill_results;
DROP TRIGGER IF EXISTS update_diagnostic_stage_on_hard_skill_result ON public.hard_skill_results;

-- 14. Создаём новые триггеры для агрегации результатов
CREATE TRIGGER aggregate_soft_skill_results_trigger
  AFTER INSERT ON public.soft_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION public.aggregate_soft_skill_results();

CREATE TRIGGER aggregate_hard_skill_results_trigger
  AFTER INSERT ON public.hard_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION public.aggregate_hard_skill_results();

-- 15. Создаём триггер для обновления статуса диагностического этапа
CREATE TRIGGER update_diagnostic_stage_on_soft_skill_result
  AFTER INSERT ON public.soft_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_diagnostic_stage_status();

CREATE TRIGGER update_diagnostic_stage_on_hard_skill_result
  AFTER INSERT ON public.hard_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_diagnostic_stage_status();

-- 16. Обновляем функцию завершения диагностических задач
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

-- 17. Создаём триггеры для завершения задач
CREATE TRIGGER complete_diagnostic_task_soft_skills
  AFTER INSERT ON public.soft_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION public.complete_diagnostic_task_on_surveys_completion();

CREATE TRIGGER complete_diagnostic_task_hard_skills
  AFTER INSERT ON public.hard_skill_results
  FOR EACH ROW
  EXECUTE FUNCTION public.complete_diagnostic_task_on_surveys_completion();

-- 18. Удаляем старые функции
DROP FUNCTION IF EXISTS public.aggregate_survey_360_results() CASCADE;
DROP FUNCTION IF EXISTS public.aggregate_skill_survey_results() CASCADE;

-- 19. Обновляем комментарии для документации
COMMENT ON TABLE public.soft_skill_questions IS 'Вопросы для оценки поведенческих компетенций (soft skills)';
COMMENT ON TABLE public.soft_skill_answer_options IS 'Варианты ответов для оценки soft skills (шкала 1-5)';
COMMENT ON TABLE public.soft_skill_results IS 'Результаты оценки soft skills (качества)';

COMMENT ON TABLE public.hard_skill_questions IS 'Вопросы для оценки профессиональных навыков (hard skills)';
COMMENT ON TABLE public.hard_skill_answer_options IS 'Варианты ответов для оценки hard skills (шкала навыков)';
COMMENT ON TABLE public.hard_skill_results IS 'Результаты оценки hard skills (навыки)';