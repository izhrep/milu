-- Обновляем constraint для task_type, добавляем 'survey_360_evaluation'
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS check_task_type;

ALTER TABLE public.tasks
ADD CONSTRAINT check_task_type 
CHECK (task_type IN ('assessment', 'diagnostic_stage', 'meeting', 'development', 'survey_360_evaluation'));

-- Удаляем старую функцию создания задач для диагностики
DROP FUNCTION IF EXISTS public.create_diagnostic_task_for_participant() CASCADE;

-- Создаем улучшенную функцию создания задач при добавлении участника
CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stage_record RECORD;
  manager_user_id UUID;
  participant_full_name TEXT;
BEGIN
  -- Получаем информацию об этапе
  SELECT * INTO stage_record
  FROM public.diagnostic_stages
  WHERE id = NEW.stage_id;
  
  -- Проверяем, что задача для участника еще не создана
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE user_id = NEW.user_id
      AND diagnostic_stage_id = NEW.stage_id
      AND task_type = 'diagnostic_stage'
  ) THEN
    -- Создаем только одну задачу для участника
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
      'Комплексная диагностика',
      'Необходимо пройти комплексную оценку компетенций (самооценка + выбор коллег для оценки 360). Срок: ' || stage_record.deadline_date::text,
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
  
  -- Если есть руководитель, создаем задачу для него
  IF manager_user_id IS NOT NULL THEN
    -- Получаем ФИО участника (зашифрованные данные)
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, '')) 
    INTO participant_full_name
    FROM public.users
    WHERE id = NEW.user_id;
    
    -- Проверяем, что задача для руководителя еще не создана
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE user_id = manager_user_id
        AND diagnostic_stage_id = NEW.stage_id
        AND task_type = 'survey_360_evaluation'
        AND title ILIKE '%' || participant_full_name || '%'
    ) THEN
      -- Создаем задачу для руководителя
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
$$;

-- Создаем функцию удаления задач при удалении участника
CREATE OR REPLACE FUNCTION public.delete_diagnostic_tasks_on_participant_remove()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  manager_user_id UUID;
  participant_full_name TEXT;
BEGIN
  -- Удаляем задачу участника
  DELETE FROM public.tasks
  WHERE user_id = OLD.user_id
    AND diagnostic_stage_id = OLD.stage_id
    AND task_type = 'diagnostic_stage';
  
  -- Получаем руководителя и ФИО участника
  SELECT manager_id INTO manager_user_id
  FROM public.users
  WHERE id = OLD.user_id;
  
  IF manager_user_id IS NOT NULL THEN
    SELECT CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
    INTO participant_full_name
    FROM public.users
    WHERE id = OLD.user_id;
    
    -- Удаляем задачу руководителя для этого участника
    DELETE FROM public.tasks
    WHERE user_id = manager_user_id
      AND diagnostic_stage_id = OLD.stage_id
      AND task_type = 'survey_360_evaluation'
      AND title ILIKE '%' || participant_full_name || '%';
  END IF;
  
  RETURN OLD;
END;
$$;

-- Пересоздаем триггер для создания задач
DROP TRIGGER IF EXISTS create_diagnostic_task_on_participant_add ON public.diagnostic_stage_participants;

CREATE TRIGGER create_diagnostic_task_on_participant_add
AFTER INSERT ON public.diagnostic_stage_participants
FOR EACH ROW
EXECUTE FUNCTION public.create_diagnostic_task_for_participant();

-- Создаем триггер для удаления задач
DROP TRIGGER IF EXISTS delete_diagnostic_tasks_on_participant_remove ON public.diagnostic_stage_participants;

CREATE TRIGGER delete_diagnostic_tasks_on_participant_remove
AFTER DELETE ON public.diagnostic_stage_participants
FOR EACH ROW
EXECUTE FUNCTION public.delete_diagnostic_tasks_on_participant_remove();