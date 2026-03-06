-- Исправляем функцию создания задач для участников диагностики
-- Убираем зависимость от self assignment (устраняем race condition)

CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deadline_date_value DATE;
  manager_user_id UUID;
  participant_full_name TEXT;
  manager_assignment_id UUID;
BEGIN
  -- Получаем deadline из parent_stages через diagnostic_stages
  SELECT ps.deadline_date INTO deadline_date_value
  FROM public.diagnostic_stages ds
  LEFT JOIN public.parent_stages ps ON ps.id = ds.parent_id
  WHERE ds.id = NEW.stage_id;
  
  -- Получаем руководителя участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- ===== ЗАДАЧА 1: peer_selection для участника =====
  -- Создаём задачу "Выбрать оценивающих" сразу, без ожидания self assignment
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND task_type = 'peer_selection'
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
      NULL,  -- Не привязываем к assignment, т.к. его ещё может не быть
      NULL,  -- assignment_type тоже NULL
      'Выбрать оценивающих',
      'Выберите коллег для проведения оценки 360' || 
        CASE WHEN deadline_date_value IS NOT NULL 
          THEN '. Срок: ' || deadline_date_value::text 
          ELSE '' 
        END,
      'pending',
      deadline_date_value,
      'peer_selection',
      'assessment'
    );
  END IF;
  
  -- ===== ЗАДАЧА 2: survey_360_evaluation для руководителя =====
  -- Если есть руководитель, создаём задачу для него
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
    -- Получаем ФИО участника
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) 
    INTO participant_full_name
    FROM public.users
    WHERE id = NEW.user_id;
    
    -- Ищем manager assignment (он создаётся триггером assign_surveys_to_diagnostic_participant)
    SELECT id INTO manager_assignment_id
    FROM public.survey_360_assignments
    WHERE evaluated_user_id = NEW.user_id
      AND evaluating_user_id = manager_user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND assignment_type = 'manager';
    
    -- Создаём задачу для руководителя только если assignment уже создан
    -- (триггер assign_surveys_to_diagnostic_participant создаёт assignments синхронно)
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
        'Необходимо пройти оценку 360 для ' || participant_full_name || 
          CASE WHEN deadline_date_value IS NOT NULL 
            THEN '. Срок: ' || deadline_date_value::text 
            ELSE '' 
          END,
        'pending',
        deadline_date_value,
        'survey_360_evaluation',
        'assessment'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Удаляем старый триггер
DROP TRIGGER IF EXISTS create_diagnostic_task_for_participant_trigger ON public.diagnostic_stage_participants;

-- Создаём триггер заново с ENABLE ALWAYS (не REPLICA!)
CREATE TRIGGER create_diagnostic_task_for_participant_trigger
  AFTER INSERT ON public.diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_diagnostic_task_for_participant();

-- Включаем триггер в режиме ALWAYS
ALTER TABLE public.diagnostic_stage_participants 
  ENABLE ALWAYS TRIGGER create_diagnostic_task_for_participant_trigger;