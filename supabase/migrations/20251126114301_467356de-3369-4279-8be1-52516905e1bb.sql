-- Убираем "Срок: ..." из description задач peer_selection и survey_360_evaluation
DROP FUNCTION IF EXISTS public.create_diagnostic_task_for_participant() CASCADE;

CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parent_deadline_date DATE;
  manager_user_id UUID;
  participant_full_name TEXT;
  self_assignment_id UUID;
  manager_assignment_id UUID;
BEGIN
  -- Получаем deadline_date из parent_stages через JOIN
  SELECT ps.deadline_date INTO parent_deadline_date
  FROM public.diagnostic_stages ds
  JOIN public.parent_stages ps ON ps.id = ds.parent_id
  WHERE ds.id = NEW.stage_id;
  
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
  
  -- Создаём задачу peer_selection для участника
  IF self_assignment_id IS NOT NULL AND NOT EXISTS (
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
      self_assignment_id,
      'self',
      'Выбрать оценивающих',
      'Выберите коллег для проведения оценки 360',
      'pending',
      parent_deadline_date,
      'peer_selection',
      'assessment'
    );
    
    RAISE NOTICE 'Created peer_selection task for user % in stage %', NEW.user_id, NEW.stage_id;
  ELSE
    RAISE NOTICE 'Skipped peer_selection task creation: self_assignment_id=%, task_exists=%', 
      self_assignment_id,
      EXISTS(SELECT 1 FROM tasks WHERE user_id = NEW.user_id AND diagnostic_stage_id = NEW.stage_id AND task_type = 'peer_selection');
  END IF;
  
  -- Если есть руководитель, создаём задачу оценки для него (survey_360_evaluation)
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
        'Необходимо пройти оценку 360 для ' || participant_full_name,
        'pending',
        parent_deadline_date,
        'survey_360_evaluation',
        'assessment'
      );
      
      RAISE NOTICE 'Created survey_360_evaluation task for manager % in stage %', manager_user_id, NEW.stage_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Пересоздаём триггер
DROP TRIGGER IF EXISTS create_diagnostic_task_for_participant_trigger ON public.diagnostic_stage_participants;

CREATE TRIGGER create_diagnostic_task_for_participant_trigger
  AFTER INSERT ON public.diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_diagnostic_task_for_participant();