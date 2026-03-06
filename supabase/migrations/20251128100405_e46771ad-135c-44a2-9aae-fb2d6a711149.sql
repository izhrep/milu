-- Исправление: удаляем создание peer_approval задачи из триггера
-- Задача peer_approval должна создаваться только после отправки списка оценивающих через edge функцию

DROP TRIGGER IF EXISTS create_diagnostic_task_for_participant_trigger ON public.diagnostic_stage_participants;

CREATE OR REPLACE FUNCTION public.create_diagnostic_task_for_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parent_deadline_date DATE;
BEGIN
  -- Получаем deadline_date из parent_stages через JOIN
  SELECT ps.deadline_date INTO parent_deadline_date
  FROM public.diagnostic_stages ds
  JOIN public.parent_stages ps ON ps.id = ds.parent_id
  WHERE ds.id = NEW.stage_id;
  
  -- Создаём ТОЛЬКО задачу peer_selection для участника
  -- Задача peer_approval будет создана edge функцией после отправки списка
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
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_diagnostic_task_for_participant_trigger
AFTER INSERT ON public.diagnostic_stage_participants
FOR EACH ROW
EXECUTE FUNCTION public.create_diagnostic_task_for_participant();

ALTER TABLE public.diagnostic_stage_participants 
ENABLE ALWAYS TRIGGER create_diagnostic_task_for_participant_trigger;

COMMENT ON FUNCTION public.create_diagnostic_task_for_participant() IS 
'Создает только задачу peer_selection при добавлении участника в диагностический этап. Задача peer_approval создается отдельно через edge функцию после отправки списка оценивающих.';

-- Удаляем некорректную задачу peer_approval без assignment_id
DELETE FROM public.tasks 
WHERE id = '75494d0f-37e3-452d-98cf-6e31b23561f7';