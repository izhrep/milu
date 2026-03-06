-- Обновляем функцию расчета прогресса диагностического этапа
CREATE OR REPLACE FUNCTION public.calculate_diagnostic_stage_progress(stage_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_participants integer;
  completed_both integer;
  progress numeric;
  total_hard_questions integer;
  total_soft_questions integer;
BEGIN
  -- Получаем количество участников
  SELECT COUNT(*) INTO total_participants
  FROM diagnostic_stage_participants
  WHERE stage_id = stage_id_param;
  
  IF total_participants = 0 THEN
    RETURN 0;
  END IF;
  
  -- Получаем общее количество вопросов
  SELECT COUNT(*) INTO total_hard_questions FROM hard_skill_questions;
  SELECT COUNT(*) INTO total_soft_questions FROM soft_skill_questions;
  
  -- Считаем участников, которые полностью прошли обе оценки
  SELECT COUNT(DISTINCT dsp.user_id) INTO completed_both
  FROM diagnostic_stage_participants dsp
  JOIN users u ON u.id = dsp.user_id
  WHERE dsp.stage_id = stage_id_param
    -- Hard skills: если есть вопросы, проверяем что ответили на все
    AND (
      total_hard_questions = 0 
      OR (
        SELECT COUNT(DISTINCT hsr.question_id)
        FROM hard_skill_results hsr
        WHERE hsr.evaluated_user_id = dsp.user_id
          AND hsr.evaluating_user_id = dsp.user_id
          AND hsr.diagnostic_stage_id = stage_id_param
          AND hsr.is_draft = false
      ) >= total_hard_questions
    )
    -- Soft skills: если есть вопросы, проверяем самооценку, руководителя и минимум 1 коллегу
    AND (
      total_soft_questions = 0
      OR (
        -- Самооценка: все вопросы
        (
          SELECT COUNT(DISTINCT ssr.question_id)
          FROM soft_skill_results ssr
          WHERE ssr.evaluated_user_id = dsp.user_id
            AND ssr.evaluating_user_id = dsp.user_id
            AND ssr.diagnostic_stage_id = stage_id_param
            AND ssr.is_draft = false
        ) >= total_soft_questions
        -- Оценка руководителя: все вопросы
        AND (
          u.manager_id IS NULL
          OR (
            SELECT COUNT(DISTINCT ssr.question_id)
            FROM soft_skill_results ssr
            WHERE ssr.evaluated_user_id = dsp.user_id
              AND ssr.evaluating_user_id = u.manager_id
              AND ssr.diagnostic_stage_id = stage_id_param
              AND ssr.is_draft = false
          ) >= total_soft_questions
        )
        -- Минимум 1 коллега оценил
        AND (
          SELECT COUNT(DISTINCT ssr.evaluating_user_id)
          FROM soft_skill_results ssr
          WHERE ssr.evaluated_user_id = dsp.user_id
            AND ssr.evaluating_user_id != dsp.user_id
            AND ssr.evaluating_user_id != COALESCE(u.manager_id, '00000000-0000-0000-0000-000000000000'::uuid)
            AND ssr.diagnostic_stage_id = stage_id_param
            AND ssr.is_draft = false
        ) >= 1
      )
    );
  
  -- Вычисляем процент
  progress := (completed_both::numeric / total_participants::numeric) * 100;
  
  RETURN ROUND(progress, 2);
END;
$function$;