-- Исправление триггера создания assignments при добавлении участника в этап диагностики
CREATE OR REPLACE FUNCTION public.assign_surveys_to_diagnostic_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  manager_user_id uuid;
BEGIN
  -- Получаем руководителя пользователя
  SELECT manager_id INTO manager_user_id
  FROM users
  WHERE id = NEW.user_id;
  
  -- Создаем самооценку
  INSERT INTO survey_360_assignments (
    evaluated_user_id,
    evaluating_user_id,
    diagnostic_stage_id,
    assignment_type,
    status,
    approved_at,
    approved_by
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.stage_id,
    'self',
    'approved',
    now(),
    manager_user_id  -- ✅ ИСПРАВЛЕНО: теперь руководитель
  )
  ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  
  -- Создаем оценку руководителя (если есть)
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    INSERT INTO survey_360_assignments (
      evaluated_user_id,
      evaluating_user_id,
      diagnostic_stage_id,
      assignment_type,
      status,
      is_manager_participant,
      approved_at,
      approved_by
    ) VALUES (
      NEW.user_id,
      manager_user_id,
      NEW.stage_id,
      'manager',
      'approved',
      true,
      now(),
      manager_user_id  -- ✅ ИСПРАВЛЕНО: теперь руководитель
    )
    ON CONFLICT (evaluated_user_id, evaluating_user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Исправление триггера создания задач при добавлении участника в этап диагностики
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stage_record RECORD;
  manager_user_id UUID;
  participant_full_name TEXT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Получаем руководителя участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- Получаем ID самооценки из survey_360_assignments
  SELECT id INTO self_assignment_id
  FROM public.survey_360_assignments
  WHERE evaluated_user_id = NEW.user_id
    AND evaluating_user_id = NEW.user_id
    AND diagnostic_stage_id = NEW.stage_id
    AND assignment_type = 'self';
  
  -- Создаём только одну задачу для участника: самооценка
  IF self_assignment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND task_type = 'diagnostic_stage'
      AND assignment_id = self_assignment_id
  ) THEN
    INSERT INTO public.tasks (
      user_id,
      diagnostic_stage_id,
      assignment_id,
      assignment_type,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      self_assignment_id,
      'self',
      'Пройти самооценку',
      'Необходимо пройти комплексную оценку компетенций (самооценка + выбор коллег). Срок: ' || stage_record.deadline_date::text,
      'pending',
      stage_record.deadline_date,
      'diagnostic_stage',
      'Диагностика'
    );
  END IF;
  
  -- Если есть руководитель, создаём задачу для него
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    -- Получаем ID назначения руководителя из survey_360_assignments
    SELECT id INTO manager_assignment_id
    FROM public.survey_360_assignments
    WHERE evaluated_user_id = NEW.user_id
      AND evaluating_user_id = manager_user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND assignment_type = 'manager';
    
    -- Получаем ФИО участника
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) 
    INTO participant_full_name
    FROM public.users
    WHERE id = NEW.user_id;
    
    -- Создаём задачу для руководителя только если её ещё нет
    IF manager_assignment_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = manager_user_id
        AND diagnostic_stage_id = NEW.stage_id
        AND task_type = 'survey_360_evaluation'
        AND assignment_id = manager_assignment_id
    ) THEN
      INSERT INTO public.tasks (
        user_id,
        diagnostic_stage_id,
        assignment_id,
        assignment_type,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      ) VALUES (
        manager_user_id,
        NEW.stage_id,
        manager_assignment_id,
        'manager',
        'Оценка подчинённого: ' || participant_full_name,
        'Необходимо пройти оценку 360 для ' || participant_full_name || '. Срок: ' || stage_record.deadline_date::text,
        'pending',
        stage_record.deadline_date,
        'survey_360_evaluation',
        'Оценка 360'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;