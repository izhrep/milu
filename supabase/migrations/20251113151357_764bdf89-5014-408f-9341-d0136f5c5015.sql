
-- Исправление функции проверки консистентности встреч (устранение ambiguous column reference)
DROP FUNCTION IF EXISTS public.check_meetings_data_consistency();

CREATE OR REPLACE FUNCTION public.check_meetings_data_consistency()
RETURNS TABLE(check_name text, status text, details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Проверка 1: Участники этапа без встреч
  RETURN QUERY
  SELECT 
    'participants_without_meetings'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'participants', (
        SELECT jsonb_agg(jsonb_build_object(
          'user_id', msp.user_id,
          'stage_id', msp.stage_id,
          'stage_period', ms.period
        ))
        FROM meeting_stage_participants msp
        JOIN meeting_stages ms ON msp.stage_id = ms.id
        WHERE NOT EXISTS (
          SELECT 1 FROM one_on_one_meetings m
          WHERE m.employee_id = msp.user_id
            AND m.stage_id = msp.stage_id
        )
      )
    )
  FROM meeting_stage_participants msp
  WHERE NOT EXISTS (
    SELECT 1 FROM one_on_one_meetings m
    WHERE m.employee_id = msp.user_id
      AND m.stage_id = msp.stage_id
  );
  
  -- Проверка 2: Встречи без участников этапа
  RETURN QUERY
  SELECT 
    'meetings_without_participants'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'meetings', (
        SELECT jsonb_agg(jsonb_build_object(
          'meeting_id', m.id,
          'employee_id', m.employee_id,
          'stage_id', m.stage_id
        ))
        FROM one_on_one_meetings m
        WHERE NOT EXISTS (
          SELECT 1 FROM meeting_stage_participants msp
          WHERE msp.user_id = m.employee_id
            AND msp.stage_id = m.stage_id
        )
      )
    )
  FROM one_on_one_meetings m
  WHERE NOT EXISTS (
    SELECT 1 FROM meeting_stage_participants msp
    WHERE msp.user_id = m.employee_id
      AND msp.stage_id = m.stage_id
  );
  
  -- Проверка 3: Участники без задач
  RETURN QUERY
  SELECT 
    'participants_without_tasks'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'participants', (
        SELECT jsonb_agg(jsonb_build_object(
          'user_id', msp.user_id,
          'stage_id', msp.stage_id,
          'stage_period', ms.period
        ))
        FROM meeting_stage_participants msp
        JOIN meeting_stages ms ON msp.stage_id = ms.id
        WHERE NOT EXISTS (
          SELECT 1 FROM tasks t
          WHERE t.user_id = msp.user_id
            AND t.task_type = 'meeting'
            AND t.title LIKE '%' || ms.period || '%'
        )
      )
    )
  FROM meeting_stage_participants msp
  JOIN meeting_stages ms ON msp.stage_id = ms.id
  WHERE NOT EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.user_id = msp.user_id
      AND t.task_type = 'meeting'
      AND t.title LIKE '%' || ms.period || '%'
  );
  
  -- Проверка 4: Встречи с некорректными статусами (исправлена - убрана неоднозначность)
  RETURN QUERY
  SELECT 
    'meetings_invalid_status_transitions'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'meetings', (
        SELECT jsonb_agg(jsonb_build_object(
          'meeting_id', m.id,
          'status', m.status,
          'submitted_at', m.submitted_at,
          'approved_at', m.approved_at,
          'returned_at', m.returned_at
        ))
        FROM one_on_one_meetings m
        WHERE (m.status = 'submitted' AND m.submitted_at IS NULL)
          OR (m.status = 'approved' AND m.approved_at IS NULL)
          OR (m.status = 'returned' AND m.returned_at IS NULL)
      )
    )
  FROM one_on_one_meetings om
  WHERE (om.status = 'submitted' AND om.submitted_at IS NULL)
    OR (om.status = 'approved' AND om.approved_at IS NULL)
    OR (om.status = 'returned' AND om.returned_at IS NULL);
  
  -- Проверка 5: Решения без встреч
  RETURN QUERY
  SELECT 
    'decisions_without_meetings'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'decisions', (
        SELECT jsonb_agg(jsonb_build_object(
          'decision_id', md.id,
          'meeting_id', md.meeting_id
        ))
        FROM meeting_decisions md
        WHERE NOT EXISTS (
          SELECT 1 FROM one_on_one_meetings m
          WHERE m.id = md.meeting_id
        )
      )
    )
  FROM meeting_decisions md
  WHERE NOT EXISTS (
    SELECT 1 FROM one_on_one_meetings m
    WHERE m.id = md.meeting_id
  );
END;
$function$;

COMMENT ON FUNCTION public.check_meetings_data_consistency() IS 
'Проверяет консистентность данных модуля встреч 1:1: участников, встреч, задач и решений';
