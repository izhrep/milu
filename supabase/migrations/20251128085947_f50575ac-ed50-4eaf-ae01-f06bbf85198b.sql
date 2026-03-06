-- Исправление триггера создания задач при добавлении участника в диагностический этап

-- 1. Удаляем старый триггер
DROP TRIGGER IF EXISTS create_diagnostic_task_for_participant_trigger ON public.diagnostic_stage_participants;

-- 2. Пересоздаем функцию без зависимости от существования assignments
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
BEGIN
  -- Получаем deadline_date из parent_stages через JOIN
  SELECT ps.deadline_date INTO parent_deadline_date
  FROM public.diagnostic_stages ds
  JOIN public.parent_stages ps ON ps.id = ds.parent_id
  WHERE ds.id = NEW.stage_id;
  
  -- Получаем руководителя и ФИО участника
  SELECT manager_id, CONCAT(last_name, ' ', first_name, ' ', COALESCE(middle_name, ''))
  INTO manager_user_id, participant_full_name
  FROM public.users
  WHERE id = NEW.user_id;
  
  -- Создаём задачу peer_selection для участника БЕЗУСЛОВНО
  -- (не зависит от существования assignment - это исправляет race condition)
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
    'Выбрать оценивающих',
    'Выберите коллег для проведения оценки 360',
    'pending',
    parent_deadline_date,
    'peer_selection',
    'assessment'
  )
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Created peer_selection task for user % in stage %', NEW.user_id, NEW.stage_id;
  
  -- Если есть руководитель, создаём задачу peer_approval для него
  IF manager_user_id IS NOT NULL AND manager_user_id != NEW.user_id THEN
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
      'Утвердить оценивающих для ' || participant_full_name,
      'Рассмотрите и утвердите список оценивающих, выбранный сотрудником',
      'pending',
      parent_deadline_date,
      'peer_approval',
      'assessment'
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created peer_approval task for manager % in stage %', manager_user_id, NEW.stage_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Создаем триггер с правильным режимом ENABLE ALWAYS
CREATE TRIGGER create_diagnostic_task_for_participant_trigger
AFTER INSERT ON public.diagnostic_stage_participants
FOR EACH ROW
EXECUTE FUNCTION public.create_diagnostic_task_for_participant();

-- Важно: устанавливаем режим ALWAYS явно
ALTER TABLE public.diagnostic_stage_participants 
ENABLE ALWAYS TRIGGER create_diagnostic_task_for_participant_trigger;

COMMENT ON FUNCTION public.create_diagnostic_task_for_participant() IS 
'Создает задачи peer_selection и peer_approval при добавлении участника в диагностический этап. Триггер работает в режиме ALWAYS для обработки обычных INSERT операций.';