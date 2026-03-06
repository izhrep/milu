-- Обновляем функцию создания задач при добавлении участника в этап диагностики
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
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Создаём только одну задачу для участника: комплексная диагностика
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND task_type = 'diagnostic_stage'
  ) THEN
    INSERT INTO public.tasks (
      user_id,
      diagnostic_stage_id,
      title,
      description,
      status,
      deadline,
      task_type,
      category
    ) VALUES (
      NEW.user_id,
      NEW.stage_id,
      'Комплексная диагностика (самооценка + выбор коллег)',
      'Необходимо пройти комплексную оценку компетенций. Срок: ' || stage_record.deadline_date::text,
      'pending',
      stage_record.deadline_date,
      'diagnostic_stage',
      'Диагностика'
    );
  END IF;
  
  -- Получаем руководителя участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- Если есть руководитель, создаём задачу для него
  IF manager_user_id IS NOT NULL THEN
    -- Получаем ФИО участника (зашифрованные данные будут расшифрованы на клиенте)
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) 
    INTO participant_full_name
    FROM public.users
    WHERE id = NEW.user_id;
    
    -- Создаём задачу для руководителя только если её ещё нет
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = manager_user_id
        AND diagnostic_stage_id = NEW.stage_id
        AND task_type = 'survey_360_evaluation'
        AND title ILIKE '%' || participant_full_name || '%'
    ) THEN
      INSERT INTO public.tasks (
        user_id,
        diagnostic_stage_id,
        title,
        description,
        status,
        deadline,
        task_type,
        category
      ) VALUES (
        manager_user_id,
        NEW.stage_id,
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